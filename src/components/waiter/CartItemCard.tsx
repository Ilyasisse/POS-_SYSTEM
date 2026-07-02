import { Button } from "@/components/ui/button";
import type { CartLine } from "@/lib/types";

type CartItemCardProps = {
  line: CartLine;
  onChangeQuantity: (cartKey: string, delta: number) => void;
  onRemove: (cartKey: string) => void;
};

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

function getStationLabel(station: CartLine["station"]) {
  if (!station) return null;

  return station === "BARISTA" ? "Barista" : "Kitchen";
}

export default function CartItemCard({
  line,
  onChangeQuantity,
  onRemove,
}: CartItemCardProps) {
  const modifiers = Array.isArray(line.selectedModifiers)
    ? line.selectedModifiers
    : [];
  const unitPrice = Number(line.finalPrice ?? line.price);
  const lineTotal = roundToTwo(unitPrice * line.quantity);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              Qty {line.quantity}
            </span>
            {line.product.category?.name ? (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                {line.product.category.name}
              </span>
            ) : null}
            {getStationLabel(line.station) ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                {getStationLabel(line.station)}
              </span>
            ) : null}
          </div>

          <p className="text-base font-extrabold leading-tight text-foreground">
            {line.name}
          </p>
          {line.assignedUserName ? (
            <p className="text-xs font-semibold text-amber-700">
              Barista: {line.assignedUserName}
            </p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-base font-black text-[#2E7D32]">
            ${lineTotal.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            ${roundToTwo(unitPrice).toFixed(2)} each
          </p>
        </div>
      </div>

      {modifiers.length > 0 ? (
        <div className="mt-3 rounded-xl bg-muted/50 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Modifiers
          </p>
          <div className="mt-2 space-y-2">
            {modifiers.map((modifier) => (
              <div
                key={`${line.cartKey}-${modifier.optionId}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {modifier.optionName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {modifier.groupName}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-emerald-700">
                  +${Number(modifier.price).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => onChangeQuantity(line.cartKey, -1)}
            className="min-h-10 min-w-10 rounded-lg bg-muted px-2 text-sm font-bold text-foreground"
          >
            -
          </Button>
          <span className="w-8 text-center text-sm font-bold text-foreground">
            {line.quantity}
          </span>
          <Button
            type="button"
            onClick={() => onChangeQuantity(line.cartKey, 1)}
            className="min-h-10 min-w-10 rounded-lg bg-muted px-2 text-sm font-bold text-foreground"
          >
            +
          </Button>
        </div>

        <Button
          type="button"
          onClick={() => onRemove(line.cartKey)}
          className="min-h-10 rounded-lg bg-red-50 px-3 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
