export type StatusSummary = {
  ok: number;
  low: number;
  out: number;
};

export type InventoryStatus = "OK" | "LOW" | "OUT";

export type InventorySupplyRow = {
  id: string;
  name: string;
  stockQty: number;
  unit: string;
  canonicalUnit: "GRAM" | "MILLILITRE" | "PIECE" | null;
  quantityCoverage: "COMPLETE" | "LEGACY_INCOMPLETE" | "MISSING_COST";
  lowStockThreshold: number;
  status: InventoryStatus;
};

export type InventoryMovementRow = {
  id: string;
  itemName: string;
  reason: string;
  delta: number;
  createdAt: Date;
};

export type AdminInventoryPageProps = {
  searchParams?: Promise<{
    inventoryEmail?: string;
    q?: string;
    status?: string;
  }>;
};
