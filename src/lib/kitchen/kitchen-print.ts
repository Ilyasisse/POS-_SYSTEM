import type { KitchenStation } from "@/lib/kitchen/kitchen-socket";

const STATION_LABELS: Record<KitchenStation, string> = {
  CUNTO_SOOMAALI: "Cunto Soomaali",
  FAST_FOOD: "Fast Food",
  CABITAAN: "Cabitaan",
  BARISTA: "Barista",
};

export function kitchenStationLabel(station: KitchenStation) {
  return STATION_LABELS[station];
}

export function buildKitchenPrintHref(
  orderId: string,
  station?: KitchenStation | null,
) {
  const base = `/print/kitchen/${encodeURIComponent(orderId)}`;
  return station ? `${base}?station=${encodeURIComponent(station)}` : base;
}
