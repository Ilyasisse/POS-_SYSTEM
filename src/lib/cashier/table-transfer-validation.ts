export type TableTransferState = {
  sourceTableId: string;
  targetTableId: string;
  sourceExists: boolean;
  targetExists: boolean;
  sourceOpenOrderCount: number;
  targetOpenOrderCount: number;
};

export function assertTableTransferAllowed(state: TableTransferState) {
  if (!state.sourceTableId || !state.targetTableId) {
    throw new Error("Select both the current table and destination table.");
  }
  if (state.sourceTableId === state.targetTableId) {
    throw new Error("Select a different destination table.");
  }
  if (!state.sourceExists || !state.targetExists) {
    throw new Error("Both tables must be active.");
  }
  if (state.sourceOpenOrderCount === 0) {
    throw new Error("The current table no longer has an open order.");
  }
  if (state.targetOpenOrderCount > 0) {
    throw new Error("The destination table is already occupied.");
  }
}
