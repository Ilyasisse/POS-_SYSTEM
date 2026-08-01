import { Prisma, type SupplierInvoiceSource } from "@prisma/client";
import {
  getSupplierBillDefaultDueDateKey,
  getSupplierPurchaseTodayDateKey,
  supplierPurchaseDateKeyToDatabaseDate,
} from "@/lib/suppliers/purchase-orders";

const QUANTITY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;
const PRICE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const POSITIVE_MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const MAX_QUANTITY = new Prisma.Decimal("999999999.999");
const MAX_UNIT_PRICE = new Prisma.Decimal("9999999999.99");
const MAX_LINE_TOTAL = new Prisma.Decimal("999999999999.99");
const MAX_INVOICE_TOTAL = new Prisma.Decimal("999999999999.99");
const MAX_INVOICE_ITEMS = 100;
const MAX_INSTALLMENTS = 50;

export type SupplierInvoiceLineInput = {
  kind: "catalog" | "custom";
  catalogItemId?: string | null;
  itemName: string;
  itemUnit: string;
  quantity: string;
  unitPrice: string;
  notes?: string | null;
};

export type SupplierInvoiceDraftInput = {
  invoiceNumber?: string | null;
  invoiceDate: string;
  dueDate: string;
  notes?: string | null;
  lines: readonly SupplierInvoiceLineInput[];
  installments?: readonly SupplierInvoiceInstallmentInput[] | null;
};

export type SupplierInvoiceInstallmentInput = {
  id?: string | null;
  dueDate: string;
  amount: string;
};

export type SupplierPurchaseOrderInvoiceSnapshot = {
  orderNumber: number;
  items: readonly {
    supplierCatalogItemId: string;
    itemName: string;
    itemUnit: string;
    quantity: Prisma.Decimal.Value;
    unitPrice: Prisma.Decimal.Value;
  }[];
};

export type SupplierInvoiceDraftCreationMetadataInput = {
  supplierId: string;
  purchaseOrderId?: string | null;
  source: SupplierInvoiceSource;
  createdByUserId?: string | null;
  receiptObjectPath?: string | null;
  receiptContentType?: string | null;
  uploadedByEmail?: string | null;
};

export type ValidatedSupplierInvoiceLine = {
  kind: "catalog" | "custom";
  supplierCatalogItemId: string | null;
  itemName: string;
  itemUnit: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  notes: string | null;
};

export type ValidatedSupplierInvoiceDraft = {
  invoiceNumber: string | null;
  invoiceDate: Date;
  dueDate: Date;
  notes: string | null;
  lines: ValidatedSupplierInvoiceLine[];
  totalAmount: Prisma.Decimal;
  installments: ValidatedSupplierInvoiceInstallment[] | null;
};

export type ValidatedSupplierInvoiceInstallment = {
  id: string | null;
  dueDate: Date;
  amount: Prisma.Decimal;
};

export function getSupplierInvoiceVoidEffect(
  purchaseOrderId: string | null | undefined,
) {
  const normalizedPurchaseOrderId = purchaseOrderId?.trim() || null;
  return {
    purchaseOrderId: normalizedPurchaseOrderId,
    reopensPurchaseOrder: normalizedPurchaseOrderId !== null,
  };
}

function optionalTrimmedText(
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

function requiredTrimmedText(
  value: string,
  maximumLength: number,
  label: string,
) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximumLength) {
    throw new Error(`${label} is too long.`);
  }
  return normalized;
}

export function validateSupplierInvoiceDraftCreationMetadata(
  input: SupplierInvoiceDraftCreationMetadataInput,
) {
  const supplierId = input.supplierId.trim();
  const purchaseOrderId = input.purchaseOrderId?.trim() || null;
  const createdByUserId = input.createdByUserId?.trim() || null;
  if (!supplierId || supplierId.length > 191) {
    throw new Error("Choose a valid supplier.");
  }
  if (purchaseOrderId && purchaseOrderId.length > 191) {
    throw new Error("Choose a valid purchase order.");
  }
  if (createdByUserId && createdByUserId.length > 191) {
    throw new Error("Choose a valid invoice creator.");
  }
  if (input.source === "PURCHASE_ORDER" && !purchaseOrderId) {
    throw new Error("Purchase-order invoices must reference a purchase order.");
  }
  if (input.source === "PURCHASE_ORDER" && !createdByUserId) {
    throw new Error("Purchase-order invoices require a creator.");
  }
  if (input.source === "LEGACY_UPLOAD" && purchaseOrderId) {
    throw new Error(
      "Legacy uploaded invoices cannot reference a purchase order.",
    );
  }

  const receiptObjectPath = optionalTrimmedText(
    input.receiptObjectPath,
    1000,
    "Receipt object path",
  );
  const receiptContentType = optionalTrimmedText(
    input.receiptContentType,
    200,
    "Receipt content type",
  );
  if (Boolean(receiptObjectPath) !== Boolean(receiptContentType)) {
    throw new Error("Receipt path and content type must be provided together.");
  }

  return {
    supplierId,
    purchaseOrderId,
    createdByUserId,
    receiptObjectPath,
    receiptContentType,
    uploadedByEmail: optionalTrimmedText(
      input.uploadedByEmail,
      320,
      "Uploader email",
    ),
  };
}

function parseQuantity(value: string, label: string) {
  const normalized = value.trim();
  if (!QUANTITY_PATTERN.test(normalized)) {
    throw new Error(
      `${label} must be a positive number with at most three decimal places.`,
    );
  }
  const quantity = new Prisma.Decimal(normalized);
  if (quantity.lte(0) || quantity.gt(MAX_QUANTITY)) {
    throw new Error(`${label} is outside the supported range.`);
  }
  return quantity;
}

function parseUnitPrice(value: string, label: string) {
  const normalized = value.trim();
  if (!PRICE_PATTERN.test(normalized)) {
    throw new Error(
      `${label} must be a non-negative amount with at most two decimal places.`,
    );
  }
  const unitPrice = new Prisma.Decimal(normalized);
  if (unitPrice.lt(0) || unitPrice.gt(MAX_UNIT_PRICE)) {
    throw new Error(`${label} is outside the supported range.`);
  }
  return unitPrice;
}

export function calculateSupplierInvoiceLineTotal(
  quantity: Prisma.Decimal.Value,
  unitPrice: Prisma.Decimal.Value,
) {
  const lineTotal = new Prisma.Decimal(quantity)
    .mul(unitPrice)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (lineTotal.gt(MAX_LINE_TOTAL)) {
    throw new Error("Invoice line total exceeds the supported limit.");
  }
  return lineTotal;
}

export function buildSupplierInvoiceDraftFromPurchaseOrder(
  order: SupplierPurchaseOrderInvoiceSnapshot,
  now = new Date(),
): SupplierInvoiceDraftInput {
  return {
    invoiceNumber: `PO-${order.orderNumber}`,
    invoiceDate: getSupplierPurchaseTodayDateKey(now),
    dueDate: getSupplierBillDefaultDueDateKey(now),
    notes: null,
    installments: null,
    lines: order.items.map((item) => ({
      kind: "catalog" as const,
      catalogItemId: item.supplierCatalogItemId,
      itemName: item.itemName,
      itemUnit: item.itemUnit,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
    })),
  };
}

function validateInstallments(
  installments: SupplierInvoiceDraftInput["installments"],
  totalAmount: Prisma.Decimal,
) {
  if (installments === undefined || installments === null) return null;
  if (!installments.length) {
    throw new Error("Add at least one installment or use a single due date.");
  }
  if (installments.length > MAX_INSTALLMENTS) {
    throw new Error(`An invoice can have at most ${MAX_INSTALLMENTS} installments.`);
  }

  let scheduledAmount = new Prisma.Decimal(0);
  const validated = installments.map((installment, index) => {
    const label = `Installment ${index + 1}`;
    const dueDate = supplierPurchaseDateKeyToDatabaseDate(installment.dueDate);
    if (!dueDate) throw new Error(`${label} needs a valid due date.`);
    const amountText = installment.amount.trim();
    if (!POSITIVE_MONEY_PATTERN.test(amountText)) {
      throw new Error(`${label} amount must have at most two decimal places.`);
    }
    const amount = new Prisma.Decimal(amountText);
    if (amount.lte(0) || amount.gt(MAX_INVOICE_TOTAL)) {
      throw new Error(`${label} amount is outside the supported range.`);
    }
    scheduledAmount = scheduledAmount.add(amount);
    const id = installment.id?.trim() || null;
    if (id && id.length > 191) throw new Error(`${label} is invalid.`);
    return { id, dueDate, amount };
  });

  if (!scheduledAmount.equals(totalAmount)) {
    throw new Error(
      `Installments total ${scheduledAmount.toFixed(2)} but the invoice total is ${totalAmount.toFixed(2)}.`,
    );
  }
  return validated;
}

export function validateSupplierInvoiceDraftInput(
  input: SupplierInvoiceDraftInput,
): ValidatedSupplierInvoiceDraft {
  const invoiceDate = supplierPurchaseDateKeyToDatabaseDate(input.invoiceDate);
  if (!invoiceDate) throw new Error("Enter a valid invoice date.");
  const dueDate = supplierPurchaseDateKeyToDatabaseDate(input.dueDate);
  if (!dueDate) throw new Error("Enter a valid supplier bill due date.");
  if (!input.lines.length) {
    throw new Error("Add at least one invoice item before saving.");
  }
  if (input.lines.length > MAX_INVOICE_ITEMS) {
    throw new Error(
      `A supplier invoice can contain at most ${MAX_INVOICE_ITEMS} items.`,
    );
  }

  const catalogItemIds = new Set<string>();
  const lines = input.lines.map((line, index) => {
    const label = `Invoice item ${index + 1}`;
    const itemName = requiredTrimmedText(
      line.itemName,
      300,
      `${label} description`,
    );
    const itemUnit = requiredTrimmedText(line.itemUnit, 40, `${label} unit`);
    const quantity = parseQuantity(line.quantity, `${label} quantity`);
    const unitPrice = parseUnitPrice(line.unitPrice, `${label} unit price`);
    const notes = optionalTrimmedText(line.notes, 1000, `${label} notes`);

    let supplierCatalogItemId: string | null = null;
    if (line.kind === "catalog") {
      supplierCatalogItemId = line.catalogItemId?.trim() || null;
      if (!supplierCatalogItemId || supplierCatalogItemId.length > 191) {
        throw new Error(`${label} needs a valid supplier catalog item.`);
      }
      if (catalogItemIds.has(supplierCatalogItemId)) {
        throw new Error("The same supplier catalog item cannot appear twice.");
      }
      catalogItemIds.add(supplierCatalogItemId);
    } else if (line.kind !== "custom") {
      throw new Error(`${label} has an invalid item type.`);
    } else if (line.catalogItemId?.trim()) {
      throw new Error(`${label} custom lines cannot reference a catalog item.`);
    }

    return {
      kind: line.kind,
      supplierCatalogItemId,
      itemName,
      itemUnit,
      quantity,
      unitPrice,
      lineTotal: calculateSupplierInvoiceLineTotal(quantity, unitPrice),
      notes,
    };
  });

  let totalAmount = new Prisma.Decimal(0);
  for (const line of lines) {
    totalAmount = totalAmount.add(line.lineTotal);
    if (totalAmount.gt(MAX_INVOICE_TOTAL)) {
      throw new Error("Supplier invoice total exceeds the supported limit.");
    }
  }

  const roundedTotal = totalAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return {
    invoiceNumber: optionalTrimmedText(
      input.invoiceNumber,
      200,
      "Invoice number",
    ),
    invoiceDate,
    dueDate,
    notes: optionalTrimmedText(input.notes, 2000, "Invoice notes"),
    lines,
    totalAmount: roundedTotal,
    installments: validateInstallments(input.installments, roundedTotal),
  };
}
