import type { Product } from "@/lib/types";

type ProductGridProps = {
  products: Product[];
  onAddToCart: (product: Product) => void;
};

export default function ProductGrid({
  products,
  onAddToCart,
}: ProductGridProps) {
  return (
    <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3">
      {products.map((item) => (
        <button
          key={item.id}
          onClick={() => onAddToCart(item)}
          type="button"
          className="min-h-28 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#4F7CFF]"
        >
          <p className="text-sm font-bold text-slate-800">{item.name}</p>

          <p className="mt-2 text-sm font-extrabold text-[#2E7D32]">
            ${item.price}
          </p>
        </button>
      ))}
    </div>
  );
}
