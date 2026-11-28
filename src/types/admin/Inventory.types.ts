export type StatusSummary = {
  ok: number;
  low: number;
  out: number;
};

export type InventoryStatus = "OK" | "LOW" | "OUT";

export type InventorySupplyRow = {
  id: string;
  name: string;
  stockQty: string;
  stockQtyLabel: string;
  unit: string;
  stockUnit: string;
  step: string;
  hasUnitMapping: boolean;
  lowStockThreshold: string;
  status: InventoryStatus;
};

export type InventoryMovementRow = {
  id: string;
  itemName: string;
  reason: string;
  delta: string;
  deltaLabel: string;
  unit: string;
  createdAt: Date;
  occurredAt: Date;
};

export type AdminInventoryPageProps = {
  searchParams?: Promise<{
    page?: string;
    date?: string;
    inventoryEmail?: string;
    q?: string;
    status?: string;
  }>;
};
