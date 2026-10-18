import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/types";

type ProductQuickItemsProps = {
  products: Product[];
  onAddToCart: (product: Product) => void;
};

export default function ProductQuickItems({
  products,
  onAddToCart,
}: ProductQuickItemsProps) {
  return (
    <div className="rounded-2xl border border-blue-100 dark:border-blue-800 bg-card p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
        Dalab Degdeg ah
      </p>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <Button
            variant="outline"
            key={product.id}
            type="button"
            onClick={() => onAddToCart(product)}
            className="rounded-xl border border-blue-100 dark:border-blue-800 bg-card px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {product.name}
                </p>
                {product.category?.name ? (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {product.category.name}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                ${Number(product.price).toFixed(2)}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
