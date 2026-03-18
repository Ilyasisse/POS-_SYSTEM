import type { CartLine } from "@/lib/types";

type CartItemCardProps = {
  line: CartLine;
  onChangeQuantity: (productId: string, delta: number) => void;
};

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

export default function CartItemCard({
  line,
  onChangeQuantity,
}: CartItemCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{line.name}</p>
          <p className="text-xs text-slate-500">{line.sku}</p>
        </div>
        <p className="text-sm font-bold text-[#2E7D32]">
          ${roundToTwo(line.price * line.quantity)}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChangeQuantity(line.id, -1)}
          className="min-h-9 min-w-9 rounded-md bg-slate-100 px-2 text-sm font-bold text-slate-700"
        >
          -
        </button>
        <span className="w-7 text-center text-sm font-semibold">
          {line.quantity}
        </span>
        <button
          type="button"
          onClick={() => onChangeQuantity(line.id, 1)}
          className="min-h-9 min-w-9 rounded-md bg-slate-100 px-2 text-sm font-bold text-slate-700"
        >
          +
        </button>
      </div>
    </div>
  );
}