export type WaiterBalanceCapabilities = {
  canInitialize: boolean;
  canEditSettlement: boolean;
};

export function buildWaiterBalanceWaiterWhere(includeInactive = false) {
  return includeInactive
    ? { role: "WAITER" as const }
    : { role: "WAITER" as const, isActive: true };
}

export function getWaiterBalanceCapabilities(input: {
  isActive: boolean;
  hasInitialization: boolean;
  hasClosedShift: boolean;
}): WaiterBalanceCapabilities {
  const canInitialize = input.isActive && !input.hasInitialization;
  const canEditSettlement =
    input.hasInitialization && (input.isActive || input.hasClosedShift);

  return {
    canInitialize,
    canEditSettlement,
  };
}
