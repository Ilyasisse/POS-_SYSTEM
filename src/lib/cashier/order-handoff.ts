export function canTransferOpenOrder(input: {
  status: string;
  paymentCount: number;
  currentWaiterId: string | null;
  targetWaiterId: string;
}) {
  return (
    input.status === "OPEN" &&
    input.paymentCount === 0 &&
    Boolean(input.currentWaiterId) &&
    input.currentWaiterId !== input.targetWaiterId
  );
}
