import type { CartLine } from "@/lib/types";

type CartItemCardProps = {
  line: CartLine;
  onChangeQuantity: (cartKey: string, delta: number) => void;
  onRemove: (cartKey: string) => void;
};

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
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
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{line.name}</p>
          {line.sku ? (
            <p className="text-xs text-slate-500">{line.sku}</p>
          ) : null}
          {line.assignedUserName ? (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Barista: {line.assignedUserName}
            </p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="text-sm font-bold text-[#2E7D32]">
            ${lineTotal.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">
            ${roundToTwo(unitPrice).toFixed(2)} each
          </p>
        </div>
      </div>

      {modifiers.length > 0 ? (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Modifiers
          </p>
          <div className="mt-1 space-y-1">
            {modifiers.map((modifier) => (
              <div
                key={`${line.cartKey}-${modifier.optionId}`}
                className="flex items-center justify-between text-xs text-slate-600"
              >
                <span>
                  {modifier.groupName}: {modifier.optionName}
                </span>
                <span>+${Number(modifier.price).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeQuantity(line.cartKey, -1)}
            className="min-h-9 min-w-9 rounded-md bg-slate-100 px-2 text-sm font-bold text-slate-700"
          >
            -
          </button>
          <span className="w-7 text-center text-sm font-semibold">
            {line.quantity}
          </span>
          <button
            type="button"
            onClick={() => onChangeQuantity(line.cartKey, 1)}
            className="min-h-9 min-w-9 rounded-md bg-slate-100 px-2 text-sm font-bold text-slate-700"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => onRemove(line.cartKey)}
          className="min-h-9 rounded-md bg-red-50 px-3 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
