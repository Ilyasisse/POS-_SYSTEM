import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateSupplierPurchaseOrderLineTotal,
  calculateSupplierPurchaseOrderTotal,
} from "@/lib/suppliers/purchase-orders";
import {
  assertWhatsAppPdfSize,
  purchaseOrderPdfMediaPath,
} from "./pdf-access";
import { generatePurchaseOrderPdf } from "./purchase-order-pdf";
import {
  purchaseOrderPdfInclude,
  purchaseOrderPdfInput,
} from "./purchase-order-pdf-snapshot";
import {
  advanceRecurringDate,
  aggregateResponseQuantities,
  deriveRecipientToken,
  expectedDeliveryDate,
  hashRecipientToken,
  isSupplierOrderReminderDue,
  normalizeE164Phone,
} from "./scheduling";
import {
  isWhatsAppEnabled,
  readWhatsAppConfig,
  sendEmployeeOrderLink,
  sendSupplierPurchaseOrder,
} from "./whatsapp";

const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_AFTER_MS = 5 * 60 * 1000;
const UTC_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  dateStyle: "medium",
});

function linkSecret() {
  const value = process.env.SUPPLIER_ORDER_LINK_SECRET?.trim();
  if (!value) throw new Error("SUPPLIER_ORDER_LINK_SECRET is not configured.");
  return value;
}

function deadlineLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function dateLabel(date: Date) {
  return UTC_DATE_FORMATTER.format(date);
}

function money(value: Prisma.Decimal.Value) {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function createDueRuns(now: Date) {
  const schedules = await prisma.supplierOrderSchedule.findMany({
    where: { deletedAt: null, isActive: true, nextInviteAt: { lte: now } },
    include: {
      supplier: { select: { id: true, name: true, phone: true, isActive: true } },
      recipients: {
        include: {
          user: {
            select: { id: true, fullName: true, phoneNumber: true, isActive: true },
          },
        },
      },
      _count: { select: { runs: true } },
    },
    take: 50,
  });
  let created = 0;
  for (const schedule of schedules) {
    const inviteAt = schedule.nextInviteAt;
    const supplierSendAt = schedule.nextSupplierSendAt;
    if (!inviteAt || !supplierSendAt) continue;
    const supplierPhone = normalizeE164Phone(schedule.supplier.phone ?? "");
    if (!schedule.supplier.isActive || !supplierPhone) continue;
    const activeRecipients = schedule.recipients.flatMap((recipient) => {
      const phone = normalizeE164Phone(recipient.user.phoneNumber ?? "");
      return recipient.user.isActive && phone ? [{ user: recipient.user, phone }] : [];
    });
    if (activeRecipients.length === 0) continue;

    let nextInviteAt: Date | null = null;
    let nextSupplierSendAt: Date | null = null;
    if (schedule.recurrenceUnit) {
      nextInviteAt = advanceRecurringDate(
        inviteAt,
        schedule.recurrenceUnit,
        schedule.recurrenceInterval,
        schedule.timeZone,
      );
      nextSupplierSendAt = advanceRecurringDate(
        supplierSendAt,
        schedule.recurrenceUnit,
        schedule.recurrenceInterval,
        schedule.timeZone,
      );
      if (
        !nextInviteAt ||
        !nextSupplierSendAt ||
        (schedule.endAt && nextInviteAt > schedule.endAt)
      ) {
        nextInviteAt = null;
        nextSupplierSendAt = null;
      }
    }

    const recipientRows = activeRecipients.map(({ user, phone }) => {
      const id = randomUUID();
      return {
        id,
        userId: user.id,
        employeeName: user.fullName,
        phone,
        tokenHash: hashRecipientToken(deriveRecipientToken(id, linkSecret())),
      };
    });

    const didCreate = await prisma.$transaction(async (tx) => {
      const claimed = await tx.supplierOrderSchedule.updateMany({
        where: {
          id: schedule.id,
          deletedAt: null,
          isActive: true,
          nextInviteAt: inviteAt,
        },
        data: {
          nextInviteAt,
          nextSupplierSendAt,
          isActive: nextInviteAt !== null,
        },
      });
      if (claimed.count !== 1) return false;
      await tx.supplierOrderRun.create({
        data: {
          scheduleId: schedule.id,
          sequence: schedule._count.runs + 1,
          supplierId: schedule.supplier.id,
          supplierName: schedule.supplier.name,
          supplierPhone,
          timeZone: schedule.timeZone,
          inviteAt,
          supplierSendAt,
          reminderIntervalMinutes: schedule.reminderIntervalMinutes,
          deliveryLeadDays: schedule.deliveryLeadDays,
          recipients: { create: recipientRows },
        },
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (didCreate) created += 1;
  }
  return created;
}

async function attemptEmployeeMessage(
  recipient: {
    id: string;
    runId: string;
    employeeName: string;
    phone: string;
    reminderCount: number;
    run: { supplierName: string; supplierSendAt: Date; timeZone: string };
  },
  reminder: boolean,
  now: Date,
) {
  const sequence = reminder ? recipient.reminderCount + 1 : 0;
  const dedupeKey = `${recipient.runId}:${reminder ? "reminder" : "invitation"}:${recipient.id}:${sequence}`;
  const delivery = await prisma.supplierOrderWhatsAppDelivery.upsert({
    where: { dedupeKey },
    create: {
      runId: recipient.runId,
      recipientId: recipient.id,
      dedupeKey,
      type: reminder ? "REMINDER" : "INVITATION",
      recipientPhone: recipient.phone,
      provider: "TWILIO",
    },
    update: {},
  });
  if (delivery.status === "ACCEPTED" || delivery.status === "DELIVERED" || delivery.status === "READ") return false;
  if (delivery.attempts >= MAX_DELIVERY_ATTEMPTS) return false;
  if (
    delivery.lastAttemptAt &&
    now.getTime() - delivery.lastAttemptAt.getTime() < RETRY_AFTER_MS
  ) return false;

  try {
    const config = readWhatsAppConfig();
    const messageId = await sendEmployeeOrderLink({
      config,
      to: recipient.phone,
      employeeName: recipient.employeeName,
      supplierName: recipient.run.supplierName,
      deadline: deadlineLabel(recipient.run.supplierSendAt, recipient.run.timeZone),
      token: deriveRecipientToken(recipient.id, linkSecret()),
      reminder,
    });
    await prisma.$transaction([
      prisma.supplierOrderWhatsAppDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "ACCEPTED",
          provider: "TWILIO",
          providerMessageId: messageId,
          attempts: { increment: 1 },
          lastAttemptAt: now,
          acceptedAt: now,
          failedAt: null,
          errorMessage: null,
        },
      }),
      prisma.supplierOrderRunRecipient.update({
        where: { id: recipient.id },
        data: reminder
          ? { lastReminderAt: now, reminderCount: { increment: 1 } }
          : { invitedAt: now },
      }),
    ]);
    return true;
  } catch (error) {
    await prisma.supplierOrderWhatsAppDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastAttemptAt: now,
        failedAt: now,
        errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "WhatsApp delivery failed.",
      },
    });
    return false;
  }
}

async function sendDueEmployeeMessages(now: Date) {
  const runs = await prisma.supplierOrderRun.findMany({
    where: {
      schedule: { deletedAt: null },
      status: { in: ["SCHEDULED", "COLLECTING"] },
      inviteAt: { lte: now },
      supplierSendAt: { gt: now },
    },
    include: { recipients: true },
    take: 50,
  });
  let invitations = 0;
  let reminders = 0;
  for (const run of runs) {
    if (run.status === "SCHEDULED") {
      await prisma.supplierOrderRun.updateMany({
        where: { id: run.id, status: "SCHEDULED" },
        data: { status: "COLLECTING" },
      });
    }
    for (const recipient of run.recipients) {
      if (recipient.status !== "PENDING") continue;
      const context = { ...recipient, run };
      if (!recipient.invitedAt) {
        if (await attemptEmployeeMessage(context, false, now)) invitations += 1;
        continue;
      }
      if (
        isSupplierOrderReminderDue({
          status: recipient.status,
          invitedAt: recipient.invitedAt,
          lastReminderAt: recipient.lastReminderAt,
          reminderIntervalMinutes: run.reminderIntervalMinutes,
          deadline: run.supplierSendAt,
          now,
        })
      ) {
        if (await attemptEmployeeMessage(context, true, now)) reminders += 1;
      }
    }
  }
  return { invitations, reminders };
}

async function finalizeRun(runId: string, now: Date) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const run = await tx.supplierOrderRun.findFirst({
        where: {
          id: runId,
          status: "FINALIZING",
          schedule: { deletedAt: null },
        },
        include: {
          schedule: { select: { createdByUserId: true, name: true } },
          recipients: { include: { responseItems: true } },
        },
      });
      if (!run || run.purchaseOrderId) return "ignored" as const;
      const quantities = aggregateResponseQuantities(
        run.recipients.flatMap((recipient) =>
          recipient.responseItems.map((item) => ({
            catalogItemId: item.supplierCatalogItemId,
            quantity: item.quantity,
          })),
        ),
      );
      if (quantities.size === 0) {
        if (!run.recipients.some((recipient) => recipient.invitedAt)) {
          await tx.supplierOrderRun.update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              finalizedAt: now,
              failureReason: "No employee invitation was delivered before the deadline.",
            },
          });
          return "failed" as const;
        }
        await tx.supplierOrderRun.update({
          where: { id: run.id },
          data: { status: "SKIPPED", finalizedAt: now, failureReason: null },
        });
        return "skipped" as const;
      }

      const catalogItems = await tx.supplierCatalogItem.findMany({
        where: {
          id: { in: [...quantities.keys()] },
          supplierId: run.supplierId,
          isActive: true,
        },
        select: {
          id: true,
          unit: true,
          unitPrice: true,
          product: { select: { name: true, isActive: true } },
          inventorySupply: { select: { name: true, isActive: true } },
        },
      });
      if (catalogItems.length !== quantities.size) {
        throw new Error("A selected supplier catalog item is no longer available.");
      }
      const lines = catalogItems.map((item) => {
        const itemName = item.product?.isActive
          ? item.product.name
          : item.inventorySupply?.isActive
            ? item.inventorySupply.name
            : null;
        if (!itemName) throw new Error("A selected catalog item is inactive.");
        const quantity = quantities.get(item.id) as Prisma.Decimal;
        return {
          supplierCatalogItemId: item.id,
          itemName,
          itemUnit: item.unit,
          quantity,
          unitPrice: item.unitPrice,
          lineTotal: calculateSupplierPurchaseOrderLineTotal(quantity, item.unitPrice),
        };
      });
      const order = await tx.supplierPurchaseOrder.create({
        data: {
          supplierId: run.supplierId,
          expectedDeliveryDate: expectedDeliveryDate(
            run.supplierSendAt,
            run.deliveryLeadDays,
            run.timeZone,
          ),
          notes: `Automatically created from schedule: ${run.schedule.name}`,
          totalAmount: calculateSupplierPurchaseOrderTotal(lines),
          createdByUserId: run.schedule.createdByUserId,
          items: { create: lines },
        },
        select: { id: true },
      });
      await tx.supplierOrderRun.update({
        where: { id: run.id },
        data: { purchaseOrderId: order.id, finalizedAt: now, failureReason: null },
      });
      return "created" as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    return result;
  } catch (error) {
    await prisma.supplierOrderRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finalizedAt: now,
        failureReason: error instanceof Error ? error.message.slice(0, 1000) : "Purchase order finalization failed.",
      },
    });
    return "failed" as const;
  }
}

async function finalizeDueRuns(now: Date) {
  const due = await prisma.supplierOrderRun.findMany({
    where: {
      schedule: { deletedAt: null },
      status: { in: ["SCHEDULED", "COLLECTING"] },
      supplierSendAt: { lte: now },
    },
    select: { id: true },
    take: 50,
  });
  const counts = { created: 0, skipped: 0, failed: 0 };
  for (const candidate of due) {
    const claimed = await prisma.supplierOrderRun.updateMany({
      where: {
        id: candidate.id,
        schedule: { deletedAt: null },
        status: { in: ["SCHEDULED", "COLLECTING"] },
      },
      data: { status: "FINALIZING" },
    });
    if (claimed.count !== 1) continue;
    const result = await finalizeRun(candidate.id, now);
    if (result === "created") counts.created += 1;
    if (result === "skipped") counts.skipped += 1;
    if (result === "failed") counts.failed += 1;
  }
  return counts;
}

async function sendFinalizedOrders(now: Date) {
  const runs = await prisma.supplierOrderRun.findMany({
    where: {
      schedule: { deletedAt: null },
      status: "FINALIZING",
      purchaseOrderId: { not: null },
    },
    include: {
      purchaseOrder: {
        include: purchaseOrderPdfInclude,
      },
    },
    take: 25,
  });
  let sent = 0;
  let failed = 0;
  for (const run of runs) {
    const order = run.purchaseOrder;
    if (!order) continue;
    const dedupeKey = `${run.id}:supplier-order`;
    const delivery = await prisma.supplierOrderWhatsAppDelivery.upsert({
      where: { dedupeKey },
      create: {
        runId: run.id,
        dedupeKey,
        type: "SUPPLIER_ORDER",
        recipientPhone: run.supplierPhone,
        provider: "TWILIO",
      },
      update: {},
    });
    if (["ACCEPTED", "DELIVERED", "READ"].includes(delivery.status)) {
      await prisma.supplierOrderRun.update({ where: { id: run.id }, data: { status: "SENT" } });
      continue;
    }
    if (
      delivery.attempts >= MAX_DELIVERY_ATTEMPTS ||
      (delivery.lastAttemptAt && now.getTime() - delivery.lastAttemptAt.getTime() < RETRY_AFTER_MS)
    ) continue;
    try {
      const config = readWhatsAppConfig();
      const pdf = await generatePurchaseOrderPdf(purchaseOrderPdfInput(order));
      assertWhatsAppPdfSize(pdf);
      const mediaPath = purchaseOrderPdfMediaPath(
        delivery.id,
        order.orderNumber,
      );
      const messageId = await sendSupplierPurchaseOrder({
        config,
        to: run.supplierPhone,
        mediaPath,
        orderNumber: order.orderNumber,
        deliveryDate: dateLabel(order.expectedDeliveryDate),
        total: money(order.totalAmount),
      });
      await prisma.$transaction([
        prisma.supplierOrderWhatsAppDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "ACCEPTED",
            provider: "TWILIO",
            providerMessageId: messageId,
            providerMediaReference: mediaPath,
            attempts: { increment: 1 },
            lastAttemptAt: now,
            acceptedAt: now,
            failedAt: null,
            errorMessage: null,
          },
        }),
        prisma.supplierOrderRun.update({
          where: { id: run.id },
          data: { status: "SENT", failureReason: null },
        }),
      ]);
      sent += 1;
    } catch (error) {
      const attempts = delivery.attempts + 1;
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Supplier WhatsApp delivery failed.";
      await prisma.$transaction([
        prisma.supplierOrderWhatsAppDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "FAILED",
            attempts: { increment: 1 },
            lastAttemptAt: now,
            failedAt: now,
            errorMessage: message,
          },
        }),
        ...(attempts >= MAX_DELIVERY_ATTEMPTS
          ? [prisma.supplierOrderRun.update({ where: { id: run.id }, data: { status: "FAILED", failureReason: message } })]
          : []),
      ]);
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function processScheduledSupplierOrders(now = new Date()) {
  if (!isWhatsAppEnabled()) {
    return {
      enabled: false,
      runsCreated: 0,
      invitations: 0,
      reminders: 0,
      finalized: { created: 0, skipped: 0, failed: 0 },
      supplierMessages: { sent: 0, failed: 0 },
    };
  }
  const runsCreated = await createDueRuns(now);
  const employeeMessages = await sendDueEmployeeMessages(now);
  const finalized = await finalizeDueRuns(now);
  const supplierMessages = await sendFinalizedOrders(now);
  return {
    enabled: true,
    runsCreated,
    ...employeeMessages,
    finalized,
    supplierMessages,
  };
}
