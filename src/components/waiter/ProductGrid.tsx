import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/types";

type ProductGridProps = {
  products: Product[];
  onAddToCart: (product: Product) => void;
  onPlayPronunciation: (product: Product) => void;
};

export default function ProductGrid({
  products,
  onAddToCart,
  onPlayPronunciation,
}: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3">
      {products.map((item) => (
        <div
          key={item.id}
          className="group min-h-36 rounded-2xl border border-border bg-linear-to-br from-white via-slate-50 to-blue-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg"
        >
          <Button
            onClick={() => onAddToCart(item)}
            type="button"
            className="block w-full text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              {item.category?.name ? (
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  {item.category.name}
                </span>
              ) : null}
              {Array.isArray(item.modifierGroups) &&
              item.modifierGroups.length > 0 ? (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  {item.modifierGroups.length} options
                </span>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-base font-extrabold leading-tight text-foreground md:text-lg">
                {item.name}
              </p>

              {item.description ? (
                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
          </Button>

          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-lg font-black text-[#2E7D32]">
              ${Number(item.price).toFixed(2)}
            </p>

            <Button
              type="button"
              onClick={() => onPlayPronunciation(item)}
              aria-label={`Play pronunciation for ${item.name}`}
              title={`Play pronunciation for ${item.name}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
              >
                <path d="M14.86 4.53a1.25 1.25 0 0 1 2.14.88v13.18a1.25 1.25 0 0 1-2.14.88l-3.77-3.72H7.75A2.75 2.75 0 0 1 5 13V11a2.75 2.75 0 0 1 2.75-2.75h3.34l3.77-3.72ZM18.53 8.97a.75.75 0 0 1 1.06.03 4.93 4.93 0 0 1 0 7 .75.75 0 1 1-1.09-1.03 3.43 3.43 0 0 0 0-4.94.75.75 0 0 1 .03-1.06Zm-1.96 1.71a.75.75 0 0 1 1.06.03 2.52 2.52 0 0 1 0 3.58.75.75 0 1 1-1.09-1.03 1.02 1.02 0 0 0 0-1.52.75.75 0 0 1 .03-1.06Z" />
              </svg>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
