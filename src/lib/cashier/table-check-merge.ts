export type MergedRoundAssignment = {
  orderId: string;
  tableCheckRound: number;
};

export function buildMergedRoundAssignments(
  sourceOrderIds: readonly string[],
  destinationHighestRound: number,
): MergedRoundAssignment[] {
  if (!Number.isInteger(destinationHighestRound) || destinationHighestRound < 0) {
    throw new Error("Destination round must be a non-negative whole number.");
  }
  if (new Set(sourceOrderIds).size !== sourceOrderIds.length) {
    throw new Error("Source orders must be unique.");
  }
  return sourceOrderIds.map((orderId, index) => ({
    orderId,
    tableCheckRound: destinationHighestRound + index + 1,
  }));
}
