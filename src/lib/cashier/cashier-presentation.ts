/** UI hints only. All payment decisions are validated by the existing server APIs. */
export function matchesCashierTable(
  table: { name: string; billNumbers: number[] },
  search: string,
) {
  const term = search.trim().toLowerCase();
  return (
    !term ||
    table.name.toLowerCase().includes(term) ||
    table.billNumbers.some((number) => String(number) === term.replace(/^#/, ""))
  );
}

export function receiptAssignmentIssue(
  payer: { status: string; remainingAmount: number } | null,
  receipt: { amount: number | null; status: string; direction: string },
) {
  if (!payer) return "Select a payer first.";
  if (payer.status === "MATCHED") return "This payer is already fully matched.";
  if (!["PENDING", "PARTIALLY_MATCHED"].includes(payer.status))
    return "This payer request is no longer active.";
  if (receipt.status !== "AVAILABLE" || receipt.direction !== "INCOMING")
    return "Only available incoming receipts can be assigned.";
  if (receipt.amount === null || !Number.isFinite(receipt.amount) || receipt.amount <= 0)
    return "This receipt needs amount review.";
  if (!Number.isFinite(payer.remainingAmount) || payer.remainingAmount <= 0)
    return "This payer has no remaining balance.";
  if (Math.round(receipt.amount * 100) > Math.round(payer.remainingAmount * 100))
    return "Receipt exceeds this payer's remaining balance.";
  return null;
}

export function afterCashierItemAdded<T extends { message: string; error: string }>(state: T): T {
  return { ...state, message: "", error: "" };
}
