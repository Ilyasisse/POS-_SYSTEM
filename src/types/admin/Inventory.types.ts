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
  unit: string;
  createdAt: Date;
};

export type AdminInventoryPageProps = {
  searchParams?: Promise<{
    inventoryEmail?: string;
    q?: string;
    status?: string;
  }>;
};
