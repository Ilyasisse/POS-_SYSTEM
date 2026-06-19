import "server-only";

import { Prisma } from "@prisma/client";
import { extractSupplierReceipt } from "@/lib/ai/extractSupplierReceipt";
import {
  setProductInventoryLevel,
  setSupplyInventoryLevel,
} from "@/lib/inventory/inventory";
import { prisma } from "@/lib/prisma";
import { downloadSupplierReceipt } from "@/lib/suppliers/storage";

function normalizedName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseReceiptDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function processSupplierDelivery(deliveryId: string) {
  const delivery = await prisma.supplierDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      status: true,
      receiptObjectPath: true,
      receiptContentType: true,
    },
  });

  if (!delivery || delivery.status === "VERIFIED" || delivery.status === "REJECTED") {
    throw new Error("Delivery cannot be processed.");
  }

  try {
    const [bytes, products, supplies] = await Promise.all([
      downloadSupplierReceipt(delivery.receiptObjectPath),
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
      prisma.inventorySupply.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
    ]);
    const result = await extractSupplierReceipt(bytes, delivery.receiptContentType);

    await prisma.$transaction(async (tx) => {
      await tx.supplierDeliveryItem.deleteMany({ where: { deliveryId } });

      for (const item of result.parsed.items) {
        const key = normalizedName(item.name);
        const product = products.find((row) => normalizedName(row.name) === key);
        const supply = product
          ? null
          : supplies.find((row) => normalizedName(row.name) === key);

        await tx.supplierDeliveryItem.create({
          data: {
            deliveryId,
            aiItemName: item.name,
            matchedItemName: product?.name ?? supply?.name ?? null,
            productId: product?.id,
            inventorySupplyId: supply?.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            confidenceScore: item.confidence,
            notes: item.notes,
            needsManualReview: item.confidence < 0.75 || (!product && !supply),
          },
        });
      }

      await tx.supplierDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "PENDING_VERIFICATION",
          invoiceNumber: result.parsed.invoiceNumber,
          receiptDate: parseReceiptDate(result.parsed.receiptDate),
          subtotalAmount: result.parsed.subtotal,
          taxAmount: result.parsed.tax,
          discountAmount: result.parsed.discount,
          totalAmount: result.parsed.grandTotal,
          aiRawResponse: jsonValue(result.rawResponse),
          aiParsedJson: jsonValue(result.parsed),
          aiError: null,
        },
      });
    });

    return result.parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Receipt extraction failed.";
    await prisma.supplierDelivery.updateMany({
      where: { id: deliveryId, status: { in: ["PENDING_AI", "PENDING_VERIFICATION"] } },
      data: { status: "PENDING_AI", aiError: message.slice(0, 2000) },
    });
    throw error;
  }
}

export type VerifiedDeliveryItemInput = {
  itemId: string;
  target: `product:${string}` | `supply:${string}`;
  verifiedQuantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  notes?: string;
};

export async function approveSupplierDelivery(
  deliveryId: string,
  verifiedByUserId: string,
  rows: VerifiedDeliveryItemInput[],
  notes?: string,
) {
  if (!rows.length) throw new Error("At least one verified item is required.");

  return prisma.$transaction(
    async (tx) => {
      const delivery = await tx.supplierDelivery.findUnique({
        where: { id: deliveryId },
        include: { items: true },
      });

      if (
        !delivery ||
        delivery.status !== "PENDING_VERIFICATION" ||
        delivery.inventoryUpdatedAt
      ) {
        throw new Error("This delivery is not available for approval.");
      }

      if (delivery.items.length !== rows.length) {
        throw new Error("Every extracted line item must be verified.");
      }

      const inputById = new Map(rows.map((row) => [row.itemId, row]));
      if (inputById.size !== rows.length) throw new Error("Duplicate delivery item.");

      const claimed = await tx.supplierDelivery.updateMany({
        where: {
          id: deliveryId,
          status: "PENDING_VERIFICATION",
          inventoryUpdatedAt: null,
        },
        data: {
          status: "VERIFIED",
          verifiedAt: new Date(),
          verifiedByUserId,
          inventoryUpdatedAt: new Date(),
          notes: notes?.trim() || delivery.notes,
        },
      });
      if (claimed.count !== 1) throw new Error("This delivery was already processed.");

      let calculatedTotal = new Prisma.Decimal(0);

      for (const item of delivery.items) {
        const input = inputById.get(item.id);
        if (!input) throw new Error(`Missing verification for ${item.aiItemName}.`);
        if (!Number.isInteger(input.verifiedQuantity) || input.verifiedQuantity <= 0) {
          throw new Error(`Verified quantity for ${item.aiItemName} must be a positive whole number.`);
        }

        const [kind, targetId] = input.target.split(":", 2);
        if (!targetId || (kind !== "product" && kind !== "supply")) {
          throw new Error(`Choose an inventory match for ${item.aiItemName}.`);
        }

        let matchedItemName: string;
        if (kind === "product") {
          const product = await tx.product.findFirst({
            where: { id: targetId, isActive: true },
          });
          if (!product) throw new Error(`Matched product for ${item.aiItemName} is unavailable.`);
          matchedItemName = product.name;
          await setProductInventoryLevel(
            tx,
            product.id,
            product.stockQty + input.verifiedQuantity,
            product.lowStockThreshold,
          );
        } else {
          const supply = await tx.inventorySupply.findFirst({
            where: { id: targetId, isActive: true },
          });
          if (!supply) throw new Error(`Matched supply for ${item.aiItemName} is unavailable.`);
          matchedItemName = supply.name;
          await setSupplyInventoryLevel(
            tx,
            supply.id,
            supply.stockQty + input.verifiedQuantity,
            supply.lowStockThreshold,
            "SUPPLIER_DELIVERY",
            `Supplier delivery ${deliveryId}`,
          );
        }

        const unitPrice = input.unitPrice == null ? null : new Prisma.Decimal(input.unitPrice);
        const lineTotal =
          input.totalPrice == null
            ? unitPrice?.mul(input.verifiedQuantity) ?? null
            : new Prisma.Decimal(input.totalPrice);
        if (lineTotal && lineTotal.isNegative()) throw new Error("Line totals cannot be negative.");
        calculatedTotal = calculatedTotal.add(lineTotal ?? 0);

        await tx.supplierDeliveryItem.update({
          where: { id: item.id },
          data: {
            productId: kind === "product" ? targetId : null,
            inventorySupplyId: kind === "supply" ? targetId : null,
            matchedItemName,
            verifiedQuantity: input.verifiedQuantity,
            unitPrice,
            totalPrice: lineTotal,
            notes: input.notes?.trim() || item.notes,
            needsManualReview: false,
          },
        });
      }

      // The manager-edited line totals are the billing truth. The AI grand total
      // remains in aiParsedJson for comparison but is never used automatically.
      const billTotal = calculatedTotal;
      if (billTotal.isNegative()) throw new Error("Delivery total cannot be negative.");

      await tx.supplierDelivery.update({
        where: { id: deliveryId },
        data: { totalAmount: billTotal },
      });

      return tx.supplierBill.create({
        data: {
          supplierId: delivery.supplierId,
          deliveryId,
          totalAmount: billTotal,
          paidAmount: 0,
          status: "UNPAID",
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function rejectSupplierDelivery(
  deliveryId: string,
  rejectedByUserId: string,
  reason: string,
) {
  const result = await prisma.supplierDelivery.updateMany({
    where: {
      id: deliveryId,
      status: { in: ["PENDING_AI", "PENDING_VERIFICATION"] },
      inventoryUpdatedAt: null,
    },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedByUserId,
      rejectionReason: reason.trim() || null,
    },
  });
  if (result.count !== 1) throw new Error("This delivery was already processed.");
}

export async function recordSupplierPayment(
  billId: string,
  recordedByUserId: string,
  amount: number,
  paymentMethod?: string,
  notes?: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be positive.");

  return prisma.$transaction(
    async (tx) => {
      const bill = await tx.supplierBill.findUnique({ where: { id: billId } });
      if (!bill) throw new Error("Supplier bill not found.");

      const paymentAmount = new Prisma.Decimal(amount);
      const nextPaid = bill.paidAmount.add(paymentAmount);
      if (nextPaid.greaterThan(bill.totalAmount)) throw new Error("Payment exceeds the remaining balance.");
      const isPaid = nextPaid.equals(bill.totalAmount);

      const payment = await tx.supplierPayment.create({
        data: {
          billId,
          amount: paymentAmount,
          paymentMethod: paymentMethod?.trim() || null,
          notes: notes?.trim() || null,
          recordedByUserId,
        },
      });

      await tx.supplierBill.update({
        where: { id: billId },
        data: {
          paidAmount: nextPaid,
          status: isPaid ? "PAID" : "PARTIAL",
          settledAt: isPaid ? payment.paidAt : null,
          settledByUserId: isPaid ? recordedByUserId : null,
        },
      });

      return payment;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
