import "server-only";

import { Prisma } from "@prisma/client";
import {
  setProductInventoryLevel,
  setSupplyInventoryLevel,
} from "@/lib/inventory/inventory";
import { extractInvoice } from "@/lib/openai/extractInvoice";
import { prisma } from "@/lib/prisma";
import {
  type InvoiceReviewRowInput,
  validateInvoiceReviewRows,
} from "@/lib/suppliers/invoice-review";
import { downloadSupplierReceipt } from "@/lib/suppliers/storage";

function normalizedName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseInvoiceDate(value: string | null) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
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
    const bytes = await downloadSupplierReceipt(delivery.receiptObjectPath);
    const [result, products, supplies] = await Promise.all([
      extractInvoice(bytes, delivery.receiptContentType),
      prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.inventorySupply.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.supplierDeliveryItem.deleteMany({ where: { deliveryId } });

      await Promise.all([
        tx.supplierDeliveryItem.createMany({
          data: result.parsed.items.map((item) => {
            const key = normalizedName(item.description);
            const product = products.find((row) => normalizedName(row.name) === key);
            const supply = product
              ? null
              : supplies.find((row) => normalizedName(row.name) === key);

            return {
              deliveryId,
              aiItemName: item.description,
              matchedItemName: product?.name ?? supply?.name ?? null,
              productId: product?.id,
              inventorySupplyId: supply?.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              confidenceScore: item.confidence,
              notes: item.notes,
              needsManualReview: item.confidence < 0.8 || (!product && !supply),
            };
          }),
        }),
        tx.supplierDelivery.update({
          where: { id: deliveryId },
          data: {
            status: "PENDING_VERIFICATION",
            extractedText: result.parsed.transcription,
            invoiceNumber: result.parsed.invoiceNumber,
            receiptDate: parseInvoiceDate(result.parsed.invoiceDate),
            subtotalAmount: result.parsed.subtotal,
            taxAmount: result.parsed.tax,
            discountAmount: result.parsed.discount,
            totalAmount: result.parsed.total,
            aiRawResponse: jsonValue(result.audit),
            aiParsedJson: jsonValue(result.parsed),
            aiError: null,
            ocrConfidence: null,
            ocrError: null,
          },
        }),
      ]);
    });

    return result.parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice extraction failed.";
    await prisma.supplierDelivery.updateMany({
      where: { id: deliveryId, status: { in: ["PENDING_EXTRACTION", "PENDING_VERIFICATION"] } },
      data: {
        status: "PENDING_EXTRACTION",
        aiError: message.slice(0, 2000),
      },
    });
    throw error;
  }
}

export type ExtractedDeliveryReviewInput = {
  invoiceNumber?: string;
  receiptDate: Date | null;
  reviewedText?: string;
  notes?: string;
  rows: InvoiceReviewRowInput[];
};

export async function approveExtractedSupplierDelivery(
  deliveryId: string,
  verifiedByUserId: string,
  input: ExtractedDeliveryReviewInput,
) {
  const rows = validateInvoiceReviewRows(input.rows);
  const invoiceNumber = input.invoiceNumber?.trim().slice(0, 200) || null;
  const reviewedText = input.reviewedText?.trim().slice(0, 20_000) || null;
  const notes = input.notes?.trim().slice(0, 2000) || null;

  return prisma.$transaction(
    async (tx) => {
      const delivery = await tx.supplierDelivery.findUnique({
        where: { id: deliveryId },
        include: { items: true, bill: true },
      });

      if (
        !delivery ||
        delivery.status !== "PENDING_VERIFICATION" ||
        delivery.inventoryUpdatedAt ||
        delivery.bill
      ) {
        throw new Error("This delivery is not available for approval.");
      }
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
          invoiceNumber,
          receiptDate: input.receiptDate,
          reviewedText,
          notes: notes || delivery.notes,
        },
      });
      if (claimed.count !== 1) throw new Error("This delivery was already processed.");

      await tx.supplierDeliveryItem.deleteMany({ where: { deliveryId } });

      const productIdSet = new Set<string>();
      const supplyIdSet = new Set<string>();
      for (const row of rows) {
        if (row.kind === "product") {
          productIdSet.add(row.targetId);
        } else {
          supplyIdSet.add(row.targetId);
        }
      }
      const productIds = Array.from(productIdSet);
      const supplyIds = Array.from(supplyIdSet);
      const [products, supplies] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, name: true, stockQty: true, lowStockThreshold: true },
        }),
        tx.inventorySupply.findMany({
          where: { id: { in: supplyIds }, isActive: true },
          select: { id: true, name: true, stockQty: true, lowStockThreshold: true },
        }),
      ]);
      const productById = new Map(products.map((product) => [product.id, product]));
      const supplyById = new Map(supplies.map((supply) => [supply.id, supply]));
      const productQuantities = new Map<string, number>();
      const supplyQuantities = new Map<string, number>();

      const review = rows.reduce(
        (acc, row) => {
          const unitPrice = row.unitPrice == null ? null : new Prisma.Decimal(row.unitPrice);
          const lineTotal = new Prisma.Decimal(row.totalPrice);

          if (row.kind === "product") {
            const product = productById.get(row.targetId);
            if (!product) throw new Error(`${row.description} is not an active product.`);
            productQuantities.set(
              product.id,
              (productQuantities.get(product.id) ?? 0) + row.quantity,
            );
            acc.deliveryItems.push({
              deliveryId,
              productId: product.id,
              inventorySupplyId: null,
              aiItemName: row.description,
              matchedItemName: product.name,
              quantity: row.quantity,
              verifiedQuantity: row.quantity,
              unitPrice,
              totalPrice: lineTotal,
              needsManualReview: false,
            });
          } else {
            const supply = supplyById.get(row.targetId);
            if (!supply) throw new Error(`${row.description} is not an active supply.`);
            supplyQuantities.set(
              supply.id,
              (supplyQuantities.get(supply.id) ?? 0) + row.quantity,
            );
            acc.deliveryItems.push({
              deliveryId,
              productId: null,
              inventorySupplyId: supply.id,
              aiItemName: row.description,
              matchedItemName: supply.name,
              quantity: row.quantity,
              verifiedQuantity: row.quantity,
              unitPrice,
              totalPrice: lineTotal,
              needsManualReview: false,
            });
          }

          acc.billTotal = acc.billTotal.add(lineTotal);
          return acc;
        },
        {
          billTotal: new Prisma.Decimal(0),
          deliveryItems: [] as Prisma.SupplierDeliveryItemCreateManyInput[],
        },
      );

      const inventoryUpdates = Promise.all([
        ...Array.from(productQuantities, ([productId, quantity]) => {
          const product = productById.get(productId);
          if (!product) throw new Error("Product not found.");
          return setProductInventoryLevel(
            tx,
            product.id,
            product.stockQty + quantity,
            product.lowStockThreshold,
          );
        }),
        ...Array.from(supplyQuantities, ([supplyId, quantity]) => {
          const supply = supplyById.get(supplyId);
          if (!supply) throw new Error("Supply not found.");
          return setSupplyInventoryLevel(
            tx,
            supply.id,
            supply.stockQty + quantity,
            supply.lowStockThreshold,
            "SUPPLIER_DELIVERY",
            `Supplier delivery ${deliveryId}`,
          );
        }),
      ]);

      await Promise.all([
        tx.supplierDeliveryItem.createMany({
          data: review.deliveryItems,
        }),
        inventoryUpdates,
        tx.supplierDelivery.update({
          where: { id: deliveryId },
          data: { totalAmount: review.billTotal },
        }),
      ]);

      return tx.supplierBill.create({
        data: {
          supplierId: delivery.supplierId,
          deliveryId,
          totalAmount: review.billTotal,
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
      status: { in: ["PENDING_EXTRACTION", "PENDING_VERIFICATION"] },
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
