import {
  MobileMoneyDirection,
  MobileMoneyReceiptStatus,
  PaymentRequestStatus,
  Prisma,
} from "@prisma/client";
import { closeSettledTableChecks } from "@/lib/cashier/table-checks";
import { getPaymentReceiptBusinessDayRange } from "@/lib/cashier/cashier-business-day";
import { prisma } from "@/lib/prisma";
import { MACRODROID_GATEWAY_ID } from "@/lib/payments/macrodroid-auth";
import {
  fingerprintSms,
  parseSahalMessage,
} from "@/lib/payments/macrodroid-sahal";

const cents = (value: unknown) => Math.round(Number(value) * 100);
const decimal = (value: number) => new Prisma.Decimal(value);
const auditValue = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function recordMacrodroidHeartbeat(
  sender: string,
  receiptReceived = false,
  now: Date = new Date(),
) {
  return prisma.paymentGatewayStatus.upsert({
    where: { id: MACRODROID_GATEWAY_ID },
    create: {
      id: MACRODROID_GATEWAY_ID,
      sender,
      lastHeartbeatAt: now,
      lastReceiptAt: receiptReceived ? now : null,
    },
    update: {
      sender,
      lastHeartbeatAt: now,
      ...(receiptReceived ? { lastReceiptAt: now } : {}),
    },
  });
}

export async function ingestMobileMoneyReceipt(input: {
  sender: string;
  rawMessage: string;
  receivedAt?: Date;
}) {
  const receivedAt = input.receivedAt ?? new Date();
  const parsed = parseSahalMessage(input.rawMessage);
  const fingerprint = fingerprintSms(input.sender, input.rawMessage);
  const data: Prisma.MobileMoneyReceiptCreateInput = parsed.ok
    ? {
        sender: input.sender.trim(),
        providerLabel: parsed.providerLabel,
        method: parsed.method,
        providerReference: parsed.providerReference,
        direction: parsed.direction,
        status: parsed.status,
        amount: new Prisma.Decimal(parsed.amount),
        currency: parsed.currency,
        counterpartyLabel: parsed.counterpartyLabel,
        counterpartyIdentifiers: parsed.counterpartyIdentifiers,
        transactionAt: parsed.transactionAt,
        providerBalance: new Prisma.Decimal(parsed.providerBalance),
        rawMessage: input.rawMessage,
        fingerprint,
        receivedAt,
      }
    : {
        sender: input.sender.trim(),
        method: "GOLIS",
        direction: MobileMoneyDirection.UNKNOWN,
        status: MobileMoneyReceiptStatus.NEEDS_REVIEW,
        rawMessage: input.rawMessage,
        fingerprint,
        parseError: parsed.error,
        receivedAt,
      };

  try {
    const receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.mobileMoneyReceipt.create({ data });
      await tx.paymentGatewayStatus.upsert({
        where: { id: MACRODROID_GATEWAY_ID },
        create: {
          id: MACRODROID_GATEWAY_ID,
          sender: input.sender.trim(),
          lastHeartbeatAt: receivedAt,
          lastReceiptAt: receivedAt,
        },
        update: {
          sender: input.sender.trim(),
          lastHeartbeatAt: receivedAt,
          lastReceiptAt: receivedAt,
        },
      });
      return created;
    });
    return { duplicate: false, receipt };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const receipt = await prisma.mobileMoneyReceipt.findFirst({
        where: {
          OR: [
            { fingerprint },
            ...(parsed.ok
              ? [
                  {
                    method: parsed.method,
                    providerReference: parsed.providerReference,
                  } as const,
                ]
              : []),
          ],
        },
      });
      if (receipt) {
        await recordMacrodroidHeartbeat(input.sender, true, receivedAt);
        return { duplicate: true, receipt };
      }
    }
    throw error;
  }
}

export async function listMobileMoneyReceipts(now: Date = new Date()) {
  const { start, end } = getPaymentReceiptBusinessDayRange(now);
  return prisma.mobileMoneyReceipt.findMany({
    where: {
      OR: [
        { transactionAt: { gte: start, lt: end } },
        { transactionAt: null, receivedAt: { gte: start, lt: end } },
      ],
    },
    include: {
      paymentRequest: {
        select: {
          id: true,
          payerName: true,
          payerPhone: true,
          expectedAmount: true,
          table: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ transactionAt: "desc" }, { receivedAt: "desc" }],
  });
}

export async function assignMobileMoneyReceipt(input: {
  receiptId: string;
  paymentRequestId: string;
  cashier: { id: string; fullName: string };
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const { start, end } = getPaymentReceiptBusinessDayRange(now);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "PaymentRequest" WHERE "id" = $1 FOR UPDATE',
      input.paymentRequestId,
    );
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "MobileMoneyReceipt" WHERE "id" = $1 FOR UPDATE',
      input.receiptId,
    );

    const [request, receipt] = await Promise.all([
      tx.paymentRequest.findUnique({
        where: { id: input.paymentRequestId },
        include: { payments: { select: { amountPaid: true } } },
      }),
      tx.mobileMoneyReceipt.findUnique({ where: { id: input.receiptId } }),
    ]);

    if (!request) throw new Error("Payment request not found.");
    if (!receipt) throw new Error("Payment receipt not found.");
    if (request.cashierId !== input.cashier.id) {
      throw new Error("This payer row belongs to another cashier.");
    }
    if (
      request.status === PaymentRequestStatus.CANCELLED ||
      request.status === PaymentRequestStatus.EXPIRED ||
      request.status === PaymentRequestStatus.MATCHED
    ) {
      throw new Error("This payer row is no longer accepting payments.");
    }
    if (request.expiresAt < now) {
      throw new Error("This payer row has expired. Start a new payment check.");
    }
    if (
      receipt.status !== MobileMoneyReceiptStatus.AVAILABLE ||
      receipt.direction !== MobileMoneyDirection.INCOMING ||
      receipt.assignedPaymentRequestId
    ) {
      throw new Error("This receipt has already been assigned or is not selectable.");
    }
    if (
      !receipt.transactionAt ||
      receipt.transactionAt < start ||
      receipt.transactionAt >= end
    ) {
      throw new Error("Only receipts from the current payment business day are selectable.");
    }
    if (receipt.method !== request.method || request.method !== "GOLIS") {
      throw new Error("This receipt does not match the payer row payment method.");
    }
    if (!receipt.amount || !receipt.providerReference) {
      throw new Error("This receipt is missing required payment details.");
    }

    const alreadyPaidCents = request.payments.reduce(
      (sum, payment) => sum + cents(payment.amountPaid),
      0,
    );
    const requestRemainingCents = Math.max(
      0,
      cents(request.expectedAmount) - alreadyPaidCents,
    );
    const receiptCents = cents(receipt.amount);
    if (receiptCents <= 0 || receiptCents > requestRemainingCents) {
      throw new Error(
        "The receipt amount exceeds this payer row's remaining $" +
          (requestRemainingCents / 100).toFixed(2) +
          ".",
      );
    }

    const claim = await tx.mobileMoneyReceipt.updateMany({
      where: {
        id: receipt.id,
        status: MobileMoneyReceiptStatus.AVAILABLE,
        assignedPaymentRequestId: null,
      },
      data: {
        status: MobileMoneyReceiptStatus.ASSIGNED,
        assignedPaymentRequestId: request.id,
        assignedByUserId: input.cashier.id,
        assignedByName: input.cashier.fullName,
        assignedAt: now,
      },
    });
    if (claim.count !== 1) {
      throw new Error("Another cashier assigned this receipt first.");
    }

    const orders = await tx.order.findMany({
      where: { tableId: request.tableId, type: "DINE_IN", status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: { payments: { select: { amountPaid: true } } },
    });
    let unallocatedCents = receiptCents;
    for (const order of orders) {
      if (unallocatedCents <= 0) break;
      const paidCents = order.payments.reduce(
        (sum, payment) => sum + cents(payment.amountPaid),
        0,
      );
      const orderRemainingCents = Math.max(0, cents(order.total) - paidCents);
      const allocationCents = Math.min(orderRemainingCents, unallocatedCents);
      if (!allocationCents) continue;

      await tx.payment.create({
        data: {
          orderId: order.id,
          cashierId: request.cashierId,
          cashierName: request.cashierName,
          method: request.method,
          amountPaid: decimal(allocationCents / 100),
          reference: [
            receipt.providerReference,
            order.id,
            receipt.id,
          ].join(":"),
          payerName: request.payerName,
          payerPhone: request.payerPhone,
          paymentRequestId: request.id,
          mobileMoneyReceiptId: receipt.id,
          createdAt: receipt.transactionAt,
        },
      });
      unallocatedCents -= allocationCents;
      if (allocationCents === orderRemainingCents) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID", closedAt: receipt.transactionAt },
        });
      }
    }
    if (unallocatedCents > 0) {
      throw new Error("The receipt exceeds the table's remaining balance.");
    }

    const totalPaidCents = alreadyPaidCents + receiptCents;
    const fullyMatched = totalPaidCents === cents(request.expectedAmount);
    const updatedRequest = await tx.paymentRequest.update({
      where: { id: request.id },
      data: {
        status: fullyMatched
          ? PaymentRequestStatus.MATCHED
          : PaymentRequestStatus.PARTIALLY_MATCHED,
        matchedAt: fullyMatched ? receipt.transactionAt : null,
      },
    });

    await closeSettledTableChecks(
      tx,
      orders.map((order) => order.tableCheckId),
      receipt.transactionAt,
    );
    const openOrderCount = await tx.order.count({
      where: { tableId: request.tableId, type: "DINE_IN", status: "OPEN" },
    });
    if (openOrderCount === 0) {
      await tx.paymentDeferral.updateMany({
        where: { tableId: request.tableId, resolvedAt: null },
        data: { resolvedAt: receipt.transactionAt },
      });
    }

    return {
      request: updatedRequest,
      receipt: await tx.mobileMoneyReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
      }),
      paidAmount: totalPaidCents / 100,
      remainingAmount:
        (cents(request.expectedAmount) - totalPaidCents) / 100,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 5_000 });
}

export async function reverseMobileMoneyReceipt(input: {
  receiptId: string;
  actor: { id: string; fullName: string };
  reason: string;
  now?: Date;
}) {
  const reason = input.reason.trim();
  if (reason.length < 5) {
    throw new Error("Enter a correction reason of at least 5 characters.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "MobileMoneyReceipt" WHERE "id" = $1 FOR UPDATE',
      input.receiptId,
    );
    const receipt = await tx.mobileMoneyReceipt.findUnique({
      where: { id: input.receiptId },
      include: {
        paymentRequest: true,
        payments: {
          select: {
            id: true,
            orderId: true,
            order: { select: { tableCheckId: true } },
          },
        },
      },
    });
    if (
      !receipt ||
      receipt.status !== MobileMoneyReceiptStatus.ASSIGNED ||
      !receipt.paymentRequest
    ) {
      throw new Error("This receipt is not currently assigned.");
    }

    const tableCheckIds = [
      ...new Set(
        receipt.payments
          .map((payment) => payment.order.tableCheckId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (tableCheckIds.length) {
      const laterOpenCheck = await tx.tableCheck.findFirst({
        where: {
          tableId: receipt.paymentRequest.tableId,
          id: { notIn: tableCheckIds },
          closedAt: null,
          createdAt: { gt: receipt.assignedAt ?? receipt.receivedAt },
        },
      });
      if (laterOpenCheck) {
        throw new Error(
          "This table has later activity. Use an accounting adjustment instead of reopening this receipt.",
        );
      }
    }

    const orderIds = [
      ...new Set(receipt.payments.map((payment) => payment.orderId)),
    ];
    await tx.payment.deleteMany({ where: { mobileMoneyReceiptId: receipt.id } });
    for (const orderId of orderIds) {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { payments: { select: { amountPaid: true } } },
      });
      const paidCents = order.payments.reduce(
        (sum, payment) => sum + cents(payment.amountPaid),
        0,
      );
      const fullyPaid = paidCents >= cents(order.total);
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: fullyPaid ? "PAID" : "OPEN",
          closedAt: fullyPaid ? order.closedAt : null,
        },
      });
    }
    if (tableCheckIds.length) {
      await tx.tableCheck.updateMany({
        where: { id: { in: tableCheckIds } },
        data: { closedAt: null },
      });
    }

    const remainingPayments = await tx.payment.findMany({
      where: { paymentRequestId: receipt.paymentRequest.id },
      select: { amountPaid: true },
    });
    const paidCents = remainingPayments.reduce(
      (sum, payment) => sum + cents(payment.amountPaid),
      0,
    );
    await tx.paymentRequest.update({
      where: { id: receipt.paymentRequest.id },
      data: {
        status:
          paidCents === 0
            ? PaymentRequestStatus.PENDING
            : paidCents >= cents(receipt.paymentRequest.expectedAmount)
              ? PaymentRequestStatus.MATCHED
              : PaymentRequestStatus.PARTIALLY_MATCHED,
        matchedAt:
          paidCents >= cents(receipt.paymentRequest.expectedAmount)
            ? receipt.paymentRequest.matchedAt
            : null,
      },
    });
    await tx.paymentDeferral.updateMany({
      where: {
        tableId: receipt.paymentRequest.tableId,
        resolvedAt: { not: null },
      },
      data: { resolvedAt: null },
    });

    const available = await tx.mobileMoneyReceipt.update({
      where: { id: receipt.id },
      data: {
        status: MobileMoneyReceiptStatus.AVAILABLE,
        assignedPaymentRequestId: null,
        assignedByUserId: null,
        assignedByName: null,
        assignedAt: null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.id,
        action: "mobile_money_receipt.assignment_reversed",
        entityType: "MobileMoneyReceipt",
        entityId: receipt.id,
        reason,
        previousValue: auditValue({
          status: receipt.status,
          paymentRequestId: receipt.assignedPaymentRequestId,
          assignedByUserId: receipt.assignedByUserId,
          assignedAt: receipt.assignedAt,
          paymentIds: receipt.payments.map((payment) => payment.id),
        }),
        newValue: auditValue({
          status: available.status,
          assignedPaymentRequestId: null,
        }),
        relatedEntityType: "PaymentRequest",
        relatedEntityId: receipt.paymentRequest.id,
      },
    });
    return available;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 5_000 });
}

export async function reviewMobileMoneyReceipt(input: {
  receiptId: string;
  actor: { id: string; fullName: string };
  reason: string;
  direction: "INCOMING" | "OUTGOING";
  providerReference: string;
  amount: number;
  counterpartyLabel: string;
  counterpartyIdentifiers: string[];
  transactionAt: Date;
  providerBalance: number;
}) {
  const reason = input.reason.trim();
  const providerReference = input.providerReference.trim();
  const counterpartyLabel = input.counterpartyLabel.trim();
  const identifiers = [
    ...new Set(input.counterpartyIdentifiers.map((value) => value.trim()).filter(Boolean)),
  ];
  if (reason.length < 5) throw new Error("Enter a review reason of at least 5 characters.");
  if (!/^\d+$/.test(providerReference)) throw new Error("Enter the numeric SAHAL Tix reference.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter a valid positive amount.");
  if (!counterpartyLabel) throw new Error("Enter the complete counterparty label.");
  if (Number.isNaN(input.transactionAt.getTime())) throw new Error("Enter a valid Nairobi transaction date and time.");
  if (!Number.isFinite(input.providerBalance) || input.providerBalance < 0) throw new Error("Enter a valid provider balance.");

  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "MobileMoneyReceipt" WHERE "id" = $1 FOR UPDATE',
      input.receiptId,
    );
    const receipt = await tx.mobileMoneyReceipt.findUnique({ where: { id: input.receiptId } });
    if (!receipt || receipt.status !== MobileMoneyReceiptStatus.NEEDS_REVIEW) {
      throw new Error("This receipt is no longer waiting for review.");
    }
    const nextStatus = input.direction === "INCOMING"
      ? MobileMoneyReceiptStatus.AVAILABLE
      : MobileMoneyReceiptStatus.OUTGOING;
    const updated = await tx.mobileMoneyReceipt.update({
      where: { id: receipt.id },
      data: {
        providerLabel: "SAHAL",
        method: "GOLIS",
        providerReference,
        direction: input.direction,
        status: nextStatus,
        amount: decimal(input.amount),
        currency: "USD",
        counterpartyLabel,
        counterpartyIdentifiers: identifiers,
        transactionAt: input.transactionAt,
        providerBalance: decimal(input.providerBalance),
        parseError: null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.id,
        action: "mobile_money_receipt.reviewed",
        entityType: "MobileMoneyReceipt",
        entityId: receipt.id,
        reason,
        previousValue: auditValue({
          status: receipt.status,
          direction: receipt.direction,
          parseError: receipt.parseError,
          rawMessage: receipt.rawMessage,
        }),
        newValue: auditValue({
          status: updated.status,
          direction: updated.direction,
          providerReference: updated.providerReference,
          amount: updated.amount,
          counterpartyLabel: updated.counterpartyLabel,
          counterpartyIdentifiers: updated.counterpartyIdentifiers,
          transactionAt: updated.transactionAt,
          providerBalance: updated.providerBalance,
        }),
      },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 5_000 });
}
