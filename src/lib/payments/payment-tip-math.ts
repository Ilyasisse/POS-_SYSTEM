export function paymentLineCents(amount: number, tipAmount: number) {
  const billCents = Math.round(amount * 100);
  const tipCents = Math.round(tipAmount * 100);
  if (
    !Number.isFinite(billCents) ||
    !Number.isFinite(tipCents) ||
    billCents <= 0 ||
    tipCents < 0
  ) {
    throw new Error("Bill amounts must be positive and tips cannot be negative.");
  }
  return { billCents, tipCents, expectedCents: billCents + tipCents };
}

export function allocateReceiptWithTip(input: {
  billCents: number;
  billPaidCents: number;
  expectedCents: number;
  receivedCents: number;
  receiptCents: number;
}) {
  const remainingExpectedCents = Math.max(
    0,
    input.expectedCents - input.receivedCents,
  );
  if (input.receiptCents <= 0 || input.receiptCents > remainingExpectedCents) {
    throw new Error("The receipt exceeds the payer row's remaining amount.");
  }
  const billAllocationCents = Math.min(
    input.receiptCents,
    Math.max(0, input.billCents - input.billPaidCents),
  );
  const totalReceivedCents = input.receivedCents + input.receiptCents;
  return {
    billAllocationCents,
    totalReceivedCents,
    remainingExpectedCents: input.expectedCents - totalReceivedCents,
    fullyMatched: totalReceivedCents === input.expectedCents,
  };
}
