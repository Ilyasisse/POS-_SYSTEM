import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateSupplierInvoiceDraftInput } from "@/lib/suppliers/invoice-foundation";
import {
  addSupplierInvoiceCalendarDays,
  advanceSupplierInvoiceRecurrenceDate,
  supplierInvoiceDateKey,
  supplierInvoiceDueOffsetDays,
  type SupplierInvoiceRecurrenceInput,
  validateSupplierInvoiceRecurrenceInput,
} from "@/lib/suppliers/invoice-recurrence";
import {
  getSupplierPurchaseTodayDateKey,
  supplierPurchaseDateKeyToDatabaseDate,
} from "@/lib/suppliers/purchase-orders";

const SERIALIZABLE = Prisma.TransactionIsolationLevel.Serializable;
const DEFAULT_GENERATION_LIMIT = 100;

type CreateRecurrenceInput = {
  invoiceId: string;
  createdByUserId: string;
  recurrence: SupplierInvoiceRecurrenceInput;
  now?: Date;
};

function activeCatalogName(item: {
  isActive: boolean;
  product: { name: string; isActive: boolean } | null;
  inventorySupply: { name: string; isActive: boolean } | null;
}) {
  if (!item.isActive) return null;
  if (item.product?.isActive) return item.product.name;
  if (item.inventorySupply?.isActive) return item.inventorySupply.name;
  return null;
}

export async function createSupplierInvoiceRecurrenceInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateRecurrenceInput,
) {
  const now = input.now ?? new Date();
  const schedule = validateSupplierInvoiceRecurrenceInput(input.recurrence, now);
  const invoice = await tx.supplierInvoice.findUnique({
    where: { id: input.invoiceId.trim() },
    include: {
      templateRecurrence: { select: { id: true } },
      supplier: { select: { isActive: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice) throw new Error("Supplier invoice not found.");
  if (invoice.source !== "MANUAL" || invoice.status === "VOID") {
    throw new Error("Only a non-void manual invoice can become recurring.");
  }
  if (invoice.templateRecurrence) {
    throw new Error("This supplier invoice already has a recurring schedule.");
  }
  if (!invoice.supplier.isActive) {
    throw new Error("The invoice supplier must be active.");
  }
  if (!invoice.items.length || invoice.items.some((item) => !item.supplierCatalogItemId)) {
    throw new Error("Recurring invoices require supplier catalog items.");
  }

  const catalogItemIds = invoice.items.map(
    (item) => item.supplierCatalogItemId as string,
  );
  const activeItems = await tx.supplierCatalogItem.findMany({
    where: { id: { in: catalogItemIds }, supplierId: invoice.supplierId },
    select: {
      id: true,
      isActive: true,
      product: { select: { name: true, isActive: true } },
      inventorySupply: { select: { name: true, isActive: true } },
    },
  });
  if (
    activeItems.length !== catalogItemIds.length ||
    activeItems.some((item) => !activeCatalogName(item))
  ) {
    throw new Error("Every recurring item must be active in the supplier catalog.");
  }

  const dueOffsetDays = supplierInvoiceDueOffsetDays(
    invoice.invoiceDate,
    invoice.dueDate,
  );
  if (schedule.nextRunDate.getTime() <= invoice.invoiceDate.getTime()) {
    throw new Error("The next invoice date must be after the source invoice date.");
  }
  return tx.supplierInvoiceRecurrence.create({
    data: {
      supplierId: invoice.supplierId,
      sourceInvoiceId: invoice.id,
      unit: schedule.unit,
      interval: schedule.interval,
      nextRunDate: schedule.nextRunDate,
      anchorDay: schedule.anchorDay,
      dueOffsetDays,
      invoiceNotes: invoice.notes,
      createdByUserId: input.createdByUserId.trim(),
      items: {
        create: invoice.items.map((item, sequence) => ({
          supplierCatalogItemId: item.supplierCatalogItemId as string,
          sequence,
          quantity: item.quantity,
          notes: item.notes,
        })),
      },
    },
    include: { items: true },
  });
}

export async function createSupplierInvoiceRecurrence(
  input: CreateRecurrenceInput,
) {
  if (!input.invoiceId.trim()) throw new Error("Supplier invoice not found.");
  if (!input.createdByUserId.trim()) throw new Error("Schedule creator is required.");
  return prisma.$transaction(
    (tx) => createSupplierInvoiceRecurrenceInTransaction(tx, input),
    { isolationLevel: SERIALIZABLE },
  );
}

export async function updateSupplierInvoiceRecurrence(input: {
  recurrenceId: string;
  recurrence: SupplierInvoiceRecurrenceInput;
  now?: Date;
}) {
  const schedule = validateSupplierInvoiceRecurrenceInput(
    input.recurrence,
    input.now ?? new Date(),
  );
  const result = await prisma.supplierInvoiceRecurrence.updateMany({
    where: { id: input.recurrenceId.trim() },
    data: {
      unit: schedule.unit,
      interval: schedule.interval,
      nextRunDate: schedule.nextRunDate,
      anchorDay: schedule.anchorDay,
      lastError: null,
      lastErrorAt: null,
    },
  });
  if (result.count !== 1) throw new Error("Recurring schedule not found.");
}

export async function pauseSupplierInvoiceRecurrence(input: {
  recurrenceId: string;
  pausedByUserId: string;
}) {
  const now = new Date();
  const result = await prisma.supplierInvoiceRecurrence.updateMany({
    where: { id: input.recurrenceId.trim(), isActive: true },
    data: {
      isActive: false,
      pausedAt: now,
      pausedByUserId: input.pausedByUserId.trim(),
    },
  });
  if (result.count !== 1) throw new Error("This recurring schedule is already paused.");
}

export async function resumeSupplierInvoiceRecurrence(input: {
  recurrenceId: string;
  resumedByUserId: string;
  recurrence: SupplierInvoiceRecurrenceInput;
  now?: Date;
}) {
  const schedule = validateSupplierInvoiceRecurrenceInput(
    input.recurrence,
    input.now ?? new Date(),
  );
  const result = await prisma.supplierInvoiceRecurrence.updateMany({
    where: { id: input.recurrenceId.trim(), isActive: false },
    data: {
      isActive: true,
      unit: schedule.unit,
      interval: schedule.interval,
      nextRunDate: schedule.nextRunDate,
      anchorDay: schedule.anchorDay,
      pausedAt: null,
      pausedByUserId: null,
      lastError: null,
      lastErrorAt: null,
    },
  });
  if (result.count !== 1) throw new Error("This recurring schedule is already active.");
}

function recurrenceFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown generation error.";
  return message.slice(0, 1000);
}

function isConcurrentGeneration(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2002", "P2034"].includes(error.code)
  );
}

async function generateOneRecurringSupplierInvoice(
  recurrenceId: string,
  expectedDate: Date,
  now: Date,
) {
  return prisma.$transaction(
    async (tx) => {
      const recurrence = await tx.supplierInvoiceRecurrence.findUnique({
        where: { id: recurrenceId },
        include: {
          supplier: { select: { isActive: true } },
          sourceInvoice: { select: { status: true, source: true } },
          items: {
            orderBy: { sequence: "asc" },
            include: {
              supplierCatalogItem: {
                select: {
                  id: true,
                  supplierId: true,
                  unit: true,
                  unitPrice: true,
                  isActive: true,
                  product: { select: { name: true, isActive: true } },
                  inventorySupply: { select: { name: true, isActive: true } },
                },
              },
            },
          },
        },
      });
      if (
        !recurrence ||
        !recurrence.isActive ||
        recurrence.nextRunDate.getTime() !== expectedDate.getTime()
      ) {
        return false;
      }
      if (!recurrence.supplier.isActive) {
        throw new Error("The supplier is inactive. Reactivate it or pause this schedule.");
      }
      if (
        recurrence.sourceInvoice.source !== "MANUAL" ||
        recurrence.sourceInvoice.status === "VOID"
      ) {
        throw new Error("The source invoice is no longer eligible for recurrence.");
      }
      if (!recurrence.items.length) {
        throw new Error("The recurring template has no invoice items.");
      }

      const lines = recurrence.items.map((item) => {
        const catalogItem = item.supplierCatalogItem;
        const itemName = activeCatalogName(catalogItem);
        if (
          catalogItem.supplierId !== recurrence.supplierId ||
          !itemName
        ) {
          throw new Error(
            "A recurring catalog item is inactive or no longer belongs to this supplier.",
          );
        }
        return {
          kind: "catalog" as const,
          catalogItemId: catalogItem.id,
          itemName,
          itemUnit: catalogItem.unit,
          quantity: item.quantity.toString(),
          unitPrice: catalogItem.unitPrice.toString(),
          notes: item.notes,
        };
      });
      const dueDate = addSupplierInvoiceCalendarDays(
        expectedDate,
        recurrence.dueOffsetDays,
      );
      const draft = validateSupplierInvoiceDraftInput(
        {
          supplierReference: null,
          invoiceDate: supplierInvoiceDateKey(expectedDate),
          dueDate: supplierInvoiceDateKey(dueDate),
          notes: recurrence.invoiceNotes,
          lines,
          installments: null,
        },
        { allowCustomLines: false },
      );
      const nextRunDate = advanceSupplierInvoiceRecurrenceDate(
        expectedDate,
        recurrence.unit,
        recurrence.interval,
        recurrence.anchorDay,
      );

      await tx.supplierInvoice.create({
        data: {
          supplierId: recurrence.supplierId,
          recurrenceScheduleId: recurrence.id,
          recurrenceScheduledFor: expectedDate,
          source: "RECURRING",
          status: "DRAFT",
          supplierReference: draft.supplierReference,
          invoiceDate: draft.invoiceDate,
          dueDate: draft.dueDate,
          notes: draft.notes,
          totalAmount: draft.totalAmount,
          submittedAt: now,
          createdByUserId: recurrence.createdByUserId,
          items: {
            create: draft.lines.map((line) => ({
              supplierCatalogItemId: line.supplierCatalogItemId,
              itemName: line.itemName,
              itemUnit: line.itemUnit,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
              notes: line.notes,
            })),
          },
        },
      });
      const advanced = await tx.supplierInvoiceRecurrence.updateMany({
        where: {
          id: recurrence.id,
          isActive: true,
          nextRunDate: expectedDate,
        },
        data: {
          nextRunDate,
          lastGeneratedAt: now,
          lastError: null,
          lastErrorAt: null,
        },
      });
      if (advanced.count !== 1) {
        throw new Error("The recurring schedule changed during generation.");
      }
      return true;
    },
    { isolationLevel: SERIALIZABLE },
  );
}

export async function generateDueSupplierInvoiceDrafts(
  now = new Date(),
  limit = DEFAULT_GENERATION_LIMIT,
) {
  const today = supplierPurchaseDateKeyToDatabaseDate(
    getSupplierPurchaseTodayDateKey(now),
  );
  if (!today) throw new Error("Unable to calculate today's recurring invoice date.");
  const generationLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const failedScheduleIds = new Set<string>();
  let generated = 0;
  let failed = 0;
  let skipped = 0;

  while (generated + failed + skipped < generationLimit) {
    const recurrence = await prisma.supplierInvoiceRecurrence.findFirst({
      where: {
        isActive: true,
        nextRunDate: { lte: today },
        ...(failedScheduleIds.size
          ? { id: { notIn: [...failedScheduleIds] } }
          : {}),
      },
      orderBy: [{ nextRunDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, nextRunDate: true },
    });
    if (!recurrence) break;

    try {
      const created = await generateOneRecurringSupplierInvoice(
        recurrence.id,
        recurrence.nextRunDate,
        now,
      );
      if (created) generated += 1;
      else skipped += 1;
    } catch (error) {
      if (isConcurrentGeneration(error)) {
        skipped += 1;
        failedScheduleIds.add(recurrence.id);
        continue;
      }
      failed += 1;
      failedScheduleIds.add(recurrence.id);
      await prisma.supplierInvoiceRecurrence.updateMany({
        where: {
          id: recurrence.id,
          isActive: true,
          nextRunDate: recurrence.nextRunDate,
        },
        data: {
          lastError: recurrenceFailureMessage(error),
          lastErrorAt: now,
        },
      });
    }
  }

  const remainingBacklog = await prisma.supplierInvoiceRecurrence.count({
    where: { isActive: true, nextRunDate: { lte: today } },
  });
  return { generated, failed, skipped, remainingBacklog };
}
