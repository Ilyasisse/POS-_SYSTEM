import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildSupplierInvoiceDraftFromPurchaseOrder,
  type SupplierInvoiceDraftInput,
  type SupplierInvoiceDraftCreationMetadataInput,
  type ValidatedSupplierInvoiceDraft,
  validateSupplierInvoiceDraftCreationMetadata,
  validateSupplierInvoiceDraftInput,
} from "@/lib/suppliers/invoice-foundation";

const SERIALIZABLE = Prisma.TransactionIsolationLevel.Serializable;

export type CreateSupplierInvoiceDraftInput =
  SupplierInvoiceDraftCreationMetadataInput & {
    submittedAt?: Date;
    legacyInventoryUpdatedAt?: Date | null;
    draft: SupplierInvoiceDraftInput;
  };

function optionalText(
  value: string | null | undefined,
  maximumLength: number,
  label: string,
) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > maximumLength) {
    throw new Error(`${label} is too long.`);
  }
  return normalized;
}

async function assertCatalogOwnership(
  tx: Prisma.TransactionClient,
  supplierId: string,
  draft: ValidatedSupplierInvoiceDraft,
) {
  const ids = draft.lines.flatMap((line) =>
    line.supplierCatalogItemId ? [line.supplierCatalogItemId] : [],
  );
  if (!ids.length) return;

  const ownedCount = await tx.supplierCatalogItem.count({
    where: { id: { in: ids }, supplierId },
  });
  if (ownedCount !== ids.length) {
    throw new Error("Every catalog line must belong to the invoice supplier.");
  }
}

function itemCreateData(
  invoiceId: string,
  draft: ValidatedSupplierInvoiceDraft,
): Prisma.SupplierInvoiceItemCreateManyInput[] {
  return draft.lines.map((line) => ({
    invoiceId,
    supplierCatalogItemId: line.supplierCatalogItemId,
    itemName: line.itemName,
    itemUnit: line.itemUnit,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    notes: line.notes,
  }));
}

function draftUpdateData(draft: ValidatedSupplierInvoiceDraft) {
  return {
    invoiceNumber: draft.invoiceNumber,
    invoiceDate: draft.invoiceDate,
    dueDate: draft.dueDate,
    notes: draft.notes,
    totalAmount: draft.totalAmount,
  } satisfies Prisma.SupplierInvoiceUpdateManyMutationInput;
}

function duplicateActiveInvoice(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function concurrentTransaction(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

type PurchaseOrderInvoiceFailure =
  "not_found" | "not_open" | "not_completed" | "concurrent_change";

export class SupplierPurchaseOrderInvoiceError extends Error {
  constructor(readonly code: PurchaseOrderInvoiceFailure) {
    super(code);
  }
}

async function insertSupplierInvoiceDraft(
  tx: Prisma.TransactionClient,
  input: CreateSupplierInvoiceDraftInput,
  metadata: ReturnType<typeof validateSupplierInvoiceDraftCreationMetadata>,
  draft: ValidatedSupplierInvoiceDraft,
) {
  await assertCatalogOwnership(tx, metadata.supplierId, draft);
  return tx.supplierInvoice.create({
    data: {
      supplierId: metadata.supplierId,
      purchaseOrderId: metadata.purchaseOrderId,
      source: input.source,
      status: "DRAFT",
      ...draftUpdateData(draft),
      receiptObjectPath: metadata.receiptObjectPath,
      receiptContentType: metadata.receiptContentType,
      uploadedByEmail: metadata.uploadedByEmail,
      submittedAt: input.submittedAt,
      legacyInventoryUpdatedAt: input.legacyInventoryUpdatedAt ?? null,
      createdByUserId: metadata.createdByUserId,
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
    include: { items: true, bill: true },
  });
}

export async function createSupplierInvoiceDraft(
  input: CreateSupplierInvoiceDraftInput,
) {
  const metadata = validateSupplierInvoiceDraftCreationMetadata(input);
  const draft = validateSupplierInvoiceDraftInput(input.draft);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const [supplier, purchaseOrder] = await Promise.all([
          tx.supplier.findUnique({
            where: { id: metadata.supplierId },
            select: { id: true },
          }),
          metadata.purchaseOrderId
            ? tx.supplierPurchaseOrder.findUnique({
                where: { id: metadata.purchaseOrderId },
                select: { id: true, supplierId: true, status: true },
              })
            : null,
        ]);
        if (!supplier) throw new Error("Supplier not found.");
        if (
          metadata.purchaseOrderId &&
          (!purchaseOrder ||
            purchaseOrder.supplierId !== metadata.supplierId ||
            purchaseOrder.status !== "COMPLETED")
        ) {
          throw new Error(
            "Purchase-order invoice drafts require a completed order from the same supplier.",
          );
        }

        return insertSupplierInvoiceDraft(tx, input, metadata, draft);
      },
      { isolationLevel: SERIALIZABLE },
    );
  } catch (error) {
    if (duplicateActiveInvoice(error)) {
      throw new Error("This purchase order already has an active invoice.");
    }
    throw error;
  }
}

const purchaseOrderInvoiceInclude = {
  items: { orderBy: { createdAt: "asc" as const } },
  invoices: {
    where: { status: { in: ["DRAFT", "FINALIZED"] as const } },
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.SupplierPurchaseOrderInclude;

async function createPurchaseOrderInvoiceDraft(
  tx: Prisma.TransactionClient,
  purchaseOrder: Prisma.SupplierPurchaseOrderGetPayload<{
    include: typeof purchaseOrderInvoiceInclude;
  }>,
  createdByUserId: string,
  now: Date,
) {
  const input: CreateSupplierInvoiceDraftInput = {
    supplierId: purchaseOrder.supplierId,
    purchaseOrderId: purchaseOrder.id,
    source: "PURCHASE_ORDER",
    createdByUserId,
    submittedAt: now,
    draft: buildSupplierInvoiceDraftFromPurchaseOrder(purchaseOrder, now),
  };
  const metadata = validateSupplierInvoiceDraftCreationMetadata(input);
  const draft = validateSupplierInvoiceDraftInput(input.draft);
  return insertSupplierInvoiceDraft(tx, input, metadata, draft);
}

export async function completePurchaseOrderAndCreateInvoiceDraft(
  purchaseOrderId: string,
  createdByUserId: string,
  now = new Date(),
) {
  const id = purchaseOrderId.trim();
  const userId = createdByUserId.trim();
  if (!id) throw new SupplierPurchaseOrderInvoiceError("not_found");
  if (!userId) throw new Error("Invoice creator is required.");

  try {
    return await prisma.$transaction(
      async (tx) => {
        const order = await tx.supplierPurchaseOrder.findUnique({
          where: { id },
          include: purchaseOrderInvoiceInclude,
        });
        if (!order) throw new SupplierPurchaseOrderInvoiceError("not_found");
        if (order.invoices[0]) return { invoiceId: order.invoices[0].id };
        if (order.status !== "OPEN") {
          throw new SupplierPurchaseOrderInvoiceError("not_open");
        }

        const completed = await tx.supplierPurchaseOrder.updateMany({
          where: { id, status: "OPEN" },
          data: { status: "COMPLETED", completedAt: now, cancelledAt: null },
        });
        if (completed.count !== 1) {
          throw new SupplierPurchaseOrderInvoiceError("concurrent_change");
        }
        const invoice = await createPurchaseOrderInvoiceDraft(
          tx,
          order,
          userId,
          now,
        );
        return { invoiceId: invoice.id };
      },
      { isolationLevel: SERIALIZABLE },
    );
  } catch (error) {
    if (duplicateActiveInvoice(error) || concurrentTransaction(error)) {
      throw new SupplierPurchaseOrderInvoiceError("concurrent_change");
    }
    throw error;
  }
}

export async function createInvoiceDraftForCompletedPurchaseOrder(
  purchaseOrderId: string,
  createdByUserId: string,
  now = new Date(),
) {
  const id = purchaseOrderId.trim();
  const userId = createdByUserId.trim();
  if (!id) throw new SupplierPurchaseOrderInvoiceError("not_found");
  if (!userId) throw new Error("Invoice creator is required.");

  try {
    return await prisma.$transaction(
      async (tx) => {
        const order = await tx.supplierPurchaseOrder.findUnique({
          where: { id },
          include: purchaseOrderInvoiceInclude,
        });
        if (!order) throw new SupplierPurchaseOrderInvoiceError("not_found");
        if (order.invoices[0]) return { invoiceId: order.invoices[0].id };
        if (order.status !== "COMPLETED") {
          throw new SupplierPurchaseOrderInvoiceError("not_completed");
        }
        const invoice = await createPurchaseOrderInvoiceDraft(
          tx,
          order,
          userId,
          now,
        );
        return { invoiceId: invoice.id };
      },
      { isolationLevel: SERIALIZABLE },
    );
  } catch (error) {
    if (duplicateActiveInvoice(error) || concurrentTransaction(error)) {
      throw new SupplierPurchaseOrderInvoiceError("concurrent_change");
    }
    throw error;
  }
}

export async function saveSupplierInvoiceDraft(
  invoiceId: string,
  input: SupplierInvoiceDraftInput,
) {
  const id = invoiceId.trim();
  if (!id) throw new Error("Supplier invoice not found.");
  const draft = validateSupplierInvoiceDraftInput(input);

  return prisma.$transaction(
    async (tx) => {
      const invoice = await tx.supplierInvoice.findUnique({
        where: { id },
        select: {
          id: true,
          supplierId: true,
          purchaseOrderId: true,
          status: true,
          bill: true,
        },
      });
      if (!invoice || invoice.status !== "DRAFT" || invoice.bill) {
        throw new Error("Only a draft supplier invoice can be edited.");
      }

      await assertCatalogOwnership(tx, invoice.supplierId, draft);
      const claimed = await tx.supplierInvoice.updateMany({
        where: { id, status: "DRAFT" },
        data: draftUpdateData(draft),
      });
      if (claimed.count !== 1) {
        throw new Error("This supplier invoice is no longer a draft.");
      }

      await tx.supplierInvoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.supplierInvoiceItem.createMany({
        data: itemCreateData(id, draft),
      });

      return tx.supplierInvoice.findUniqueOrThrow({
        where: { id },
        include: { items: true, bill: true },
      });
    },
    { isolationLevel: SERIALIZABLE },
  );
}

export async function finalizeSupplierInvoice(
  invoiceId: string,
  finalizedByUserId: string,
  input: SupplierInvoiceDraftInput,
) {
  const id = invoiceId.trim();
  const userId = finalizedByUserId.trim();
  if (!id) throw new Error("Supplier invoice not found.");
  if (!userId) throw new Error("Invoice finalizer is required.");
  const draft = validateSupplierInvoiceDraftInput(input);

  return prisma.$transaction(
    async (tx) => {
      const invoice = await tx.supplierInvoice.findUnique({
        where: { id },
        select: {
          id: true,
          supplierId: true,
          purchaseOrderId: true,
          status: true,
          bill: true,
        },
      });
      if (!invoice || invoice.status !== "DRAFT" || invoice.bill) {
        throw new Error("Only a draft supplier invoice can be finalized.");
      }

      await assertCatalogOwnership(tx, invoice.supplierId, draft);
      const finalizedAt = new Date();
      const claimed = await tx.supplierInvoice.updateMany({
        where: { id, status: "DRAFT" },
        data: {
          ...draftUpdateData(draft),
          status: "FINALIZED",
          finalizedAt,
          finalizedByUserId: userId,
          voidedAt: null,
          voidedByUserId: null,
          voidReason: null,
        },
      });
      if (claimed.count !== 1) {
        throw new Error("This supplier invoice is no longer a draft.");
      }

      await tx.supplierInvoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.supplierInvoiceItem.createMany({
        data: itemCreateData(id, draft),
      });
      const bill = await tx.supplierBill.create({
        data: {
          supplierId: invoice.supplierId,
          invoiceId: id,
          deliveryId: null,
          totalAmount: draft.totalAmount,
          paidAmount: 0,
          status: "UNPAID",
          dueDate: draft.dueDate,
        },
      });

      return {
        invoiceId: id,
        purchaseOrderId: invoice.purchaseOrderId,
        billId: bill.id,
        finalizedAt,
      };
    },
    { isolationLevel: SERIALIZABLE },
  );
}

export async function voidSupplierInvoiceDraft(
  invoiceId: string,
  voidedByUserId: string,
  reason?: string | null,
) {
  const id = invoiceId.trim();
  const userId = voidedByUserId.trim();
  if (!id) throw new Error("Supplier invoice not found.");
  if (!userId) throw new Error("Invoice voiding user is required.");
  const voidReason = optionalText(reason, 1000, "Void reason");

  return prisma.$transaction(
    async (tx) => {
      const invoice = await tx.supplierInvoice.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          purchaseOrderId: true,
          bill: { select: { id: true } },
        },
      });
      if (!invoice || invoice.status !== "DRAFT" || invoice.bill) {
        throw new Error("Only a draft supplier invoice can be voided.");
      }

      const voidedAt = new Date();
      const claimed = await tx.supplierInvoice.updateMany({
        where: { id, status: "DRAFT" },
        data: {
          status: "VOID",
          voidedAt,
          voidedByUserId: userId,
          voidReason,
        },
      });
      if (claimed.count !== 1) {
        throw new Error("This supplier invoice is no longer a draft.");
      }

      if (invoice.purchaseOrderId) {
        const reopened = await tx.supplierPurchaseOrder.updateMany({
          where: { id: invoice.purchaseOrderId, status: "COMPLETED" },
          data: { status: "OPEN", completedAt: null },
        });
        if (reopened.count !== 1) {
          throw new Error("The linked purchase order could not be reopened.");
        }
      }

      return {
        invoiceId: id,
        purchaseOrderId: invoice.purchaseOrderId,
        voidedAt,
      };
    },
    { isolationLevel: SERIALIZABLE },
  );
}
