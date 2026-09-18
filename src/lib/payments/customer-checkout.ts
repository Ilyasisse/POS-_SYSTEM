import {
  CustomerCheckoutStatus,
  MobileMoneyReceiptStatus,
  Prisma,
  type Station,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createKitchenTicketState } from "@/lib/kitchen/kitchen-tickets";
import {
  deductProductInventoryForSale,
  sendInventoryAlerts,
} from "@/lib/inventory/inventory";
import { chooseUniqueCustomerCheckout } from "@/lib/payments/customer-ussd";
import type { SelectedModifierLine } from "@/lib/types";
import { getPostHogClient } from "@/lib/posthog-server";

type CheckoutLine = {
  productId: string;
  productName: string;
  qty: number;
  station: Station | null;
  assignedBaristaId: string | null;
  assignedBaristaName: string | null;
  unitPrice: number;
  lineTotal: number;
  costSnapshot: {
    unitCostSnapshot: string | null;
    costSnapshotSource: "PRODUCT_STANDARD" | "RECIPE_STANDARD" | null;
    recipeVersionId: string | null;
  };
  modifiers: SelectedModifierLine[];
};

const cents = (value: unknown) => Math.round(Number(value) * 100);
const decimal = (value: number) => new Prisma.Decimal(value);
const claimable: CustomerCheckoutStatus[] = [
  CustomerCheckoutStatus.PENDING,
  CustomerCheckoutStatus.REVIEW,
  CustomerCheckoutStatus.EXPIRED,
];

function snapshotLines(snapshot: Prisma.JsonValue): CheckoutLine[] {
  if (!Array.isArray(snapshot) || snapshot.length === 0) {
    throw new Error("Checkout lines are missing.");
  }
  return snapshot as unknown as CheckoutLine[];
}

export async function expireCustomerCheckout(checkoutId: string) {
  await prisma.customerCheckout.updateMany({
    where: {
      id: checkoutId,
      status: { in: [CustomerCheckoutStatus.PENDING, CustomerCheckoutStatus.REVIEW] },
      expiresAt: { lt: new Date() },
      receiptId: null,
    },
    data: { status: CustomerCheckoutStatus.EXPIRED },
  });
}

export async function finalizeCustomerCheckout(checkoutId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CustomerCheckout" WHERE "id" = ${checkoutId} FOR UPDATE`;
      const checkout = await tx.customerCheckout.findUnique({ where: { id: checkoutId } });
      if (!checkout) throw new Error("Checkout not found.");
      if (checkout.status === CustomerCheckoutStatus.PAID) return null;
      if (
        checkout.status !== CustomerCheckoutStatus.PAYMENT_RECEIVED &&
        checkout.status !== CustomerCheckoutStatus.NEEDS_HELP
      ) return null;
      if (!checkout.receiptId) throw new Error("Payment receipt is missing.");
      const receipt = await tx.mobileMoneyReceipt.findUnique({
        where: { id: checkout.receiptId },
      });
      if (!receipt || receipt.status !== MobileMoneyReceiptStatus.ASSIGNED ||
          !receipt.amount || !receipt.providerReference) {
        throw new Error("Assigned payment receipt is incomplete.");
      }
      if (cents(receipt.amount) !== cents(checkout.amount)) {
        throw new Error("Payment amount differs from checkout amount.");
      }

      const lines = snapshotLines(checkout.snapshot);
      const note = [
        `Customer: ${checkout.customerName}`,
        `Phone: ${checkout.payerPhone}`,
        checkout.notes ? `Note: ${checkout.notes}` : null,
      ].filter(Boolean).join(" | ");
      const order = await tx.order.create({
        data: {
          type: "TAKEOUT",
          status: "PAID",
          total: checkout.amount,
          customerId: checkout.customerId,
          notes: note,
          closedAt: receipt.transactionAt ?? new Date(),
        },
      });
      const ticketLines = lines.map((line) => ({
        id: crypto.randomUUID(),
        productName: line.productName,
        qty: line.qty,
        station: line.station,
        assignedUserId: line.assignedBaristaId,
        assignedUserName: line.assignedBaristaName,
        modifiers: line.modifiers,
      }));
      await tx.orderItem.createMany({
        data: lines.map((line, index) => ({
          id: ticketLines[index].id,
          orderId: order.id,
          productId: line.productId,
          productName: line.productName,
          qty: line.qty,
          unitPrice: decimal(line.unitPrice),
          lineTotal: decimal(line.lineTotal),
          unitCostSnapshot: line.costSnapshot.unitCostSnapshot
            ? new Prisma.Decimal(line.costSnapshot.unitCostSnapshot)
            : null,
          costSnapshotSource: line.costSnapshot.costSnapshotSource,
          recipeVersionId: line.costSnapshot.recipeVersionId,
          station: line.station,
          assignedUserId: line.assignedBaristaId,
        })),
      });
      const modifiers = lines.flatMap((line, index) =>
        line.modifiers
          .filter((modifier) => !modifier.optionId.startsWith("placeholder__"))
          .map((modifier) => ({
            orderItemId: ticketLines[index].id,
            modifierId: modifier.optionId,
            modifierName: modifier.optionName,
            qty: modifier.qty,
            price: decimal(modifier.price),
          })),
      );
      if (modifiers.length) await tx.orderItemModifier.createMany({ data: modifiers });
      await tx.payment.create({
        data: {
          orderId: order.id,
          cashierId: receipt.assignedByUserId,
          cashierName: receipt.assignedByName ?? "Automatic mobile money",
          method: "GOLIS",
          amountPaid: checkout.amount,
          reference: receipt.providerReference,
          payerName: checkout.customerName,
          payerPhone: checkout.payerPhone,
          mobileMoneyReceiptId: receipt.id,
          createdAt: receipt.transactionAt ?? new Date(),
        },
      });
      await createKitchenTicketState(tx, {
        orderId: order.id,
        lines: ticketLines,
        customerName: checkout.customerName,
        actorCustomerId: checkout.customerId,
      });
      const alerts = await deductProductInventoryForSale(
        tx,
        lines.map((line) => ({ productId: line.productId, qty: line.qty })),
        order.id,
        null,
        checkout.customerId,
      );
      await tx.customerCheckout.update({
        where: { id: checkout.id },
        data: {
          status: CustomerCheckoutStatus.PAID,
          orderId: order.id,
          paidAt: receipt.transactionAt ?? new Date(),
        },
      });
      return { order, alerts };
    }, { timeout: 15000, maxWait: 5000 });
    if (result) {
      try {
        await sendInventoryAlerts(result.alerts);
      } catch (error) {
        console.error("Checkout inventory alert delivery failed:", error);
      }
    }
    if (result) {
      try {
        const posthog = getPostHogClient();
        if (posthog) {
          const checkout = await prisma.customerCheckout.findUnique({
            where: { id: checkoutId },
            select: { customerId: true, amount: true, snapshot: true },
          });
          if (checkout) {
            posthog.capture({
              distinctId: checkout.customerId,
              event: "customer_order_placed",
              properties: {
                order_id: result.order.id,
                order_type: "TAKEOUT",
                total: Number(checkout.amount),
                item_count: Array.isArray(checkout.snapshot) ? checkout.snapshot.length : 0,
              },
            });
            await posthog.flush();
          }
        }
      } catch (error) {
        console.error("Customer checkout analytics failed:", error);
      }
    }
    return result?.order ?? null;
  } catch (error) {
    console.error("Paid customer checkout requires staff help:", checkoutId, error);
    await prisma.customerCheckout.updateMany({
      where: {
        id: checkoutId,
        status: CustomerCheckoutStatus.PAYMENT_RECEIVED,
        receiptId: { not: null },
      },
      data: { status: CustomerCheckoutStatus.NEEDS_HELP },
    });
    return null;
  }
}

export async function assignCustomerCheckoutReceipt(input: {
  checkoutId: string;
  receiptId: string;
  staff?: { id: string; fullName: string };
}) {
  const now = new Date();
  const checkoutId = input.checkoutId;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "MobileMoneyReceipt" WHERE "id" = ${input.receiptId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "CustomerCheckout" WHERE "id" = ${checkoutId} FOR UPDATE`;
    const [receipt, checkout] = await Promise.all([
      tx.mobileMoneyReceipt.findUnique({ where: { id: input.receiptId } }),
      tx.customerCheckout.findUnique({ where: { id: checkoutId } }),
    ]);
    if (!receipt || !checkout) throw new Error("Receipt or checkout not found.");
    if (!claimable.includes(checkout.status)) throw new Error("Checkout is already settled.");
    if (
      receipt.status !== MobileMoneyReceiptStatus.AVAILABLE ||
      receipt.direction !== "INCOMING" ||
      receipt.method !== "GOLIS" ||
      receipt.assignedPaymentRequestId ||
      !receipt.transactionAt ||
      !receipt.amount ||
      !receipt.providerReference
    ) throw new Error("Receipt is unavailable or incomplete.");
    if (cents(receipt.amount) !== cents(checkout.amount)) {
      throw new Error("Receipt amount does not match the checkout.");
    }
    if (receipt.transactionAt.getTime() < checkout.createdAt.getTime() - 1000) {
      throw new Error("Receipt predates the checkout.");
    }
    if (!input.staff) {
      const match = chooseUniqueCustomerCheckout({
        amount: Number(receipt.amount),
        identifiers: Array.isArray(receipt.counterpartyIdentifiers)
          ? receipt.counterpartyIdentifiers.filter((value): value is string => typeof value === "string")
          : [],
        transactionAt: receipt.transactionAt,
      }, [{
        id: checkout.id,
        amount: Number(checkout.amount),
        payerPhone: checkout.payerPhone,
        createdAt: checkout.createdAt,
        expiresAt: checkout.expiresAt,
      }], now);
      if (match !== checkout.id) throw new Error("Receipt needs staff review.");
    }    const claimed = await tx.mobileMoneyReceipt.updateMany({
      where: {
        id: receipt.id,
        status: MobileMoneyReceiptStatus.AVAILABLE,
        assignedPaymentRequestId: null,
      },
      data: {
        status: MobileMoneyReceiptStatus.ASSIGNED,
        assignedAt: now,
        assignedByUserId: input.staff?.id ?? null,
        assignedByName: input.staff?.fullName ?? null,
      },
    });
    if (claimed.count !== 1) throw new Error("Receipt was assigned elsewhere.");
    const updated = await tx.customerCheckout.updateMany({
      where: { id: checkout.id, status: { in: claimable }, receiptId: null },
      data: {
        receiptId: receipt.id,
        status: CustomerCheckoutStatus.PAYMENT_RECEIVED,
        paidAt: receipt.transactionAt,
      },
    });
    if (updated.count !== 1) throw new Error("Checkout was settled elsewhere.");
  }, { timeout: 15000, maxWait: 5000 });
  await finalizeCustomerCheckout(checkoutId);
}

export async function autoMatchCustomerReceipt(receiptId: string) {
  const receipt = await prisma.mobileMoneyReceipt.findUnique({
    where: { id: receiptId },
  });
  if (!receipt) return;
  if (receipt.status !== MobileMoneyReceiptStatus.AVAILABLE ||
      receipt.direction !== "INCOMING" || receipt.method !== "GOLIS" ||
      !receipt.amount || !receipt.transactionAt) return;
  const transactionAt = receipt.transactionAt;
  const candidates = await prisma.customerCheckout.findMany({
    where: {
      status: { in: [CustomerCheckoutStatus.PENDING, CustomerCheckoutStatus.REVIEW] },
      receiptId: null,
      amount: receipt.amount,
      createdAt: { lte: new Date(transactionAt.getTime() + 1000) },
      expiresAt: { gte: transactionAt },
    },
    take: 100,
    select: { id: true, amount: true, payerPhone: true, createdAt: true, expiresAt: true },
  });
  if (candidates.length === 100) return;
  const checkoutId = chooseUniqueCustomerCheckout({
    amount: Number(receipt.amount),
    identifiers: Array.isArray(receipt.counterpartyIdentifiers)
      ? receipt.counterpartyIdentifiers.filter((value): value is string => typeof value === "string")
      : [],
    transactionAt,
  }, candidates.map((candidate) => ({
    ...candidate,
    amount: Number(candidate.amount),
  })), new Date());
  if (!checkoutId) return;  try {
    await assignCustomerCheckoutReceipt({
      checkoutId,
      receiptId,
    });
  } catch (error) {
    console.error("Customer receipt needs staff review:", receiptId, error);
  }
}
