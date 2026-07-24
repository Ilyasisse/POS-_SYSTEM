import type {
  Prisma,
  SupplierInvoiceStatus,
  SupplierPaymentStatus,
} from "@prisma/client";
import {
  getSupplierBillDueState,
  type SupplierBillDueState,
} from "@/lib/suppliers/supplier-bills";
import {
  getSupplierPurchaseTodayDateKey,
  supplierPurchaseDateKeyToDatabaseDate,
} from "@/lib/suppliers/purchase-orders";

export const SUPPLIER_INVOICE_DISPLAY_STATUSES = [
  "DRAFT",
  "PENDING",
  "PARTIALLY_PAID",
  "OVERDUE",
  "PAID",
  "VOID",
] as const;

export type SupplierInvoiceDisplayStatus =
  (typeof SUPPLIER_INVOICE_DISPLAY_STATUSES)[number];

export type SupplierInvoiceDisplayStatusTone =
  | "amber"
  | "blue"
  | "green"
  | "red"
  | "slate";

export const SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS: Record<
  SupplierInvoiceDisplayStatus,
  string
> = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  PARTIALLY_PAID: "PARTIALLY PAID",
  OVERDUE: "OVERDUE",
  PAID: "PAID",
  VOID: "VOID",
};

export const SUPPLIER_INVOICE_DISPLAY_STATUS_TONES: Record<
  SupplierInvoiceDisplayStatus,
  SupplierInvoiceDisplayStatusTone
> = {
  DRAFT: "amber",
  PENDING: "blue",
  PARTIALLY_PAID: "amber",
  OVERDUE: "red",
  PAID: "green",
  VOID: "slate",
};

export type SupplierInvoiceStatusInput = {
  status: SupplierInvoiceStatus;
  bill: {
    status: SupplierPaymentStatus;
    dueDate: Date;
  } | null;
};

export function getSupplierInvoiceDisplayStatus(
  invoice: SupplierInvoiceStatusInput,
  now = new Date(),
): SupplierInvoiceDisplayStatus {
  if (invoice.status === "DRAFT") return "DRAFT";
  if (invoice.status === "VOID") return "VOID";

  if (!invoice.bill) return "PENDING";
  if (invoice.bill.status === "PAID") return "PAID";

  const dueState: SupplierBillDueState = getSupplierBillDueState(
    invoice.bill.dueDate,
    now,
  );
  if (dueState === "overdue") return "OVERDUE";
  if (invoice.bill.status === "PARTIAL") return "PARTIALLY_PAID";

  return "PENDING";
}

function supplierInvoiceNairobiToday(now: Date) {
  const today = supplierPurchaseDateKeyToDatabaseDate(
    getSupplierPurchaseTodayDateKey(now),
  );
  if (!today) {
    throw new Error("Unable to calculate today's supplier invoice date.");
  }
  return today;
}

export function getSupplierInvoiceDisplayStatusWhere(
  displayStatus: SupplierInvoiceDisplayStatus,
  now = new Date(),
): Prisma.SupplierInvoiceWhereInput {
  if (displayStatus === "DRAFT") return { status: "DRAFT" };
  if (displayStatus === "VOID") return { status: "VOID" };

  if (displayStatus === "PAID") {
    return {
      status: "FINALIZED",
      bill: { is: { status: "PAID" } },
    };
  }

  const today = supplierInvoiceNairobiToday(now);

  if (displayStatus === "OVERDUE") {
    return {
      status: "FINALIZED",
      bill: {
        is: {
          status: { in: ["UNPAID", "PARTIAL"] },
          dueDate: { lt: today },
        },
      },
    };
  }

  if (displayStatus === "PARTIALLY_PAID") {
    return {
      status: "FINALIZED",
      bill: {
        is: {
          status: "PARTIAL",
          dueDate: { gte: today },
        },
      },
    };
  }

  return {
    status: "FINALIZED",
    OR: [
      {
        bill: {
          is: {
            status: "UNPAID",
            dueDate: { gte: today },
          },
        },
      },
      { bill: { is: null } },
    ],
  };
}
