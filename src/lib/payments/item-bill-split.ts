export type BillItem = {
  id: string;
  label: string;
  amount: number;
};

/** Allocate whole order lines to one payer and the rest to another. */
export function splitBillByItems(
  amountDue: number,
  items: readonly BillItem[],
  selectedIds: readonly string[],
): [number, number] {
  const cents = (value: number) => {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      Math.abs(Math.round(value * 100) - value * 100) > 1e-7
    ) {
      throw new Error("Item prices must be nonnegative amounts in cents.");
    }
    return Math.round(value * 100);
  };
  const due = cents(amountDue);
  const selected = new Set(selectedIds);
  if (selected.size !== selectedIds.length || items.length < 2) {
    throw new Error("Choose at least one item for each payer.");
  }
  const known = new Set(items.map((item) => item.id));
  if (
    known.size !== items.length ||
    [...selected].some((id) => !known.has(id))
  ) {
    throw new Error("The selected items have changed. Refresh the table bill.");
  }
  const original = items.reduce((sum, item) => sum + cents(item.amount), 0);
  if (original !== due) {
    throw new Error(
      "Item splitting is unavailable after payments or bill adjustments. Split the remaining balance by amount instead.",
    );
  }
  const first = items.reduce(
    (sum, item) => sum + (selected.has(item.id) ? cents(item.amount) : 0),
    0,
  );
  if (first < 1 || due - first < 1) {
    throw new Error("Each payer must owe at least $0.01.");
  }
  return [first / 100, (due - first) / 100];
}
