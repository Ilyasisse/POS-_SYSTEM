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
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-700">
        Dalab Degdeg ah
      </p>

      <div className="flex flex-wrap gap-2">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onAddToCart(product)}
            className="min-h-11 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-100"
          >
            {product.name} | ${product.price}
          </button>
        ))}
      </div>
    </div>
  );
}
