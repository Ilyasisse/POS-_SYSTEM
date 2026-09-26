import { Prisma } from "@prisma/client";

const MAX_PAR = new Prisma.Decimal("999999999999.999999");

export function parseParLevel(value: string, warning: Prisma.Decimal.Value) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: null };
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(trimmed))
    return {
      ok: false as const,
      message: "Enter a positive quantity with up to six decimal places.",
    };
  const par = new Prisma.Decimal(trimmed);
  if (par.gt(MAX_PAR) || !par.gt(warning))
    return {
      ok: false as const,
      message: "Par must exceed the low-stock warning threshold.",
    };
  return { ok: true as const, value: par };
}

export function quantityToPar(
  current: Prisma.Decimal.Value,
  par: Prisma.Decimal.Value | null,
) {
  if (par == null) return null;
  const needed = new Prisma.Decimal(par).minus(current);
  return needed.gt(0) ? needed : new Prisma.Decimal(0);
}
