export type DailyCashStatus = "OPEN" | "FINALIZED" | "NEEDS_REVIEW" | "LOCKED";

export type DailyCashActionResult =
  | { ok: true }
  | { ok: false; code: "SAVINGS_CONFIRMATION_REQUIRED"; savingsAmount: string }
  | { ok: false; code: "INCOMPLETE_CONFIRMATION_REQUIRED"; message: string }
  | { ok: false; code: "LOCKED" | "FUTURE_DATE" | "SALARY_NOT_CONFIGURED" | "STALE_OBLIGATION" | "VALIDATION_ERROR"; message: string };

export type SupplierObligation = {
  billId: string;
  installmentId: string | null;
  supplierName: string;
  invoiceNumber: string | null;
  dueDate: Date;
  amount: number;
};

export type SupplyDayObligation = {
  supplyDayId: string;
  purchaseDate: Date;
  dueDate: Date;
  originalTotal: number;
  paidAmount: number;
  amount: number;
};

export type DailyCashPaidBreakdownRow = {
  id: string;
  type: "SALARY" | "SUPPLIER" | "SUPPLY" | "MANUAL";
  description: string;
  paidAt: Date;
  amount: number;
  revenueFunded: number;
  savingsFunded: number;
};
