import {
  Prisma,
  type CanonicalUnit,
  type StockEventType,
} from "@prisma/client";

export type LossEvent = {
  productId: string | null;
  supplyId: string | null;
  name: string;
  type: StockEventType;
  canonicalUnit: CanonicalUnit;
  quantityDelta: string;
  standardUnitCostSnapshot: string | null;
  dataCoverage: string;
};

type LossRow = {
  key: string;
  name: string;
  type: StockEventType;
  unit: CanonicalUnit;
  events: number;
  quantity: Prisma.Decimal;
  coveredEvents: number;
  knownCost: Prisma.Decimal;
};

export function summarizeInventoryLosses(events: LossEvent[]) {
  const rows = new Map<string, LossRow>();
  let coveredEvents = 0;
  let knownCost = new Prisma.Decimal(0);

  for (const event of events) {
    const key = `${event.productId ? "product" : "supply"}:${event.productId ?? event.supplyId}:${event.type}:${event.canonicalUnit}`;
    const row = rows.get(key) ?? {
      key,
      name: event.name,
      type: event.type,
      unit: event.canonicalUnit,
      events: 0,
      quantity: new Prisma.Decimal(0),
      coveredEvents: 0,
      knownCost: new Prisma.Decimal(0),
    };
    const quantity = new Prisma.Decimal(event.quantityDelta).abs();
    row.events++;
    row.quantity = row.quantity.plus(quantity);
    if (
      event.dataCoverage === "COMPLETE" &&
      event.standardUnitCostSnapshot != null
    ) {
      const cost = quantity.mul(event.standardUnitCostSnapshot);
      row.knownCost = row.knownCost.plus(cost);
      knownCost = knownCost.plus(cost);
      row.coveredEvents++;
      coveredEvents++;
    }
    rows.set(key, row);
  }
  return {
    eventCount: events.length,
    coveredEvents,
    missingCostEvents: events.length - coveredEvents,
    knownCost: knownCost.toFixed(2),
    rows: [...rows.values()]
      .sort(
        (a, b) =>
          b.events - a.events ||
          a.name.localeCompare(b.name) ||
          a.type.localeCompare(b.type),
      )
      .map(({ quantity, knownCost, ...row }) => ({
        ...row,
        quantity: quantity.toString(),
        knownCost: knownCost.toFixed(2),
      })),
  };
}
