export type InvoiceReviewRowInput = {
  description: string;
  target: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number;
};

export type ValidatedInvoiceReviewRow = InvoiceReviewRowInput & {
  target: `product:${string}` | `supply:${string}`;
  kind: "product" | "supply";
  targetId: string;
};

export function validateInvoiceReviewRows(
  rows: InvoiceReviewRowInput[],
): ValidatedInvoiceReviewRow[] {
  if (!rows.length) throw new Error("Add at least one invoice item before accepting.");

  return rows.map((row, index) => {
    const label = `Invoice item ${index + 1}`;
    const description = row.description.trim();
    if (!description) throw new Error(`${label} needs a description.`);
    if (description.length > 300) throw new Error(`${label} description is too long.`);

    const [kind, targetId] = row.target.split(":", 2);
    if (!targetId || (kind !== "product" && kind !== "supply")) {
      throw new Error(`${label} needs an inventory match.`);
    }
    if (!Number.isInteger(row.quantity) || row.quantity <= 0) {
      throw new Error(`${label} quantity must be a positive whole number.`);
    }
    if (row.unitPrice != null && (!Number.isFinite(row.unitPrice) || row.unitPrice < 0)) {
      throw new Error(`${label} unit price must be a non-negative number.`);
    }
    if (!Number.isFinite(row.totalPrice) || row.totalPrice < 0) {
      throw new Error(`${label} line total must be a non-negative number.`);
    }

    return {
      ...row,
      description,
      target: `${kind}:${targetId}`,
      kind,
      targetId,
    };
  });
}
