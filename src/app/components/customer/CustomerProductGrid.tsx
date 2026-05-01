"use client";

import type { Product, StaffSummary } from "@/lib/types";
import {
  getCustomerModifierGroups,
  getCustomerProductImage,
  isSampleProduct,
} from "./customer-fallbacks";
import { formatCurrency } from "./customer-order-utils";

type CustomerProductGridProps = {
  loading: boolean;
  products: Product[];
  baristas: StaffSummary[];
  selectedCategoryName: string;
  isFiltering?: boolean;
  onProductClick: (product: Product) => void;
};

function ProductCard({
  product,
  unavailable,
  onProductClick,
}: {
  product: Product;
  unavailable: boolean;
  onProductClick: (product: Product) => void;
}) {
  const modifierGroups = getCustomerModifierGroups(product);
  const ctaLabel = modifierGroups.length > 0 ? "Customize" : "Add";

  return (
    <article
      data-aos="fade-up"
      className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_24px_70px_rgba(67,39,20,0.14)] backdrop-blur"
    >
      <div className="relative aspect-[4/3]   overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getCustomerProductImage(product)}
          alt={product.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_18%,rgba(20,14,10,0.08)_56%,rgba(20,14,10,0.78)_100%)]" />
        <div className="absolute right-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
            {product.category?.name ?? "Menu"}
          </span>
          {product.isPopular ? (
            <span className="rounded-full border border-amber-200/30 bg-amber-300/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-50">
              Popular
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 text-white">
          <div>
            <h3
              className="text-3xl leading-tight"
              style={{
                fontFamily:
                  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
              }}
            >
              {product.name}
            </h3>
          </div>
          <div className="rounded-full border border-white/15 bg-black/25 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
            {formatCurrency(Number(product.price))}
          </div>
        </div>
      </div>

      <div className="space-y-3  p-5">
        <p className="min-h-12 text-sm leading-6 text-stone-600">
          {product.description?.trim() ||
            "Freshly prepared with a warm cafe finish and ready to customize."}
        </p>

        <div className="flex flex-wrap gap-2">
          {modifierGroups.length > 0 ? (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
              {modifierGroups.length} option group
              {modifierGroups.length > 1 ? "s" : ""}
            </span>
          ) : null}
          {isSampleProduct(product) ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              Placeholder item
            </span>
          ) : null}
          {unavailable ? (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              Temporarily unavailable
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onProductClick(product)}
          disabled={unavailable}
          className="w-full rounded-full bg-stone-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {ctaLabel}
        </button>
      </div>
    </article>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-[0_18px_50px_rgba(67,39,20,0.08)]"
        >
          <div className="aspect-[4/3] rounded-[1.5rem] bg-stone-200" />
          <div className="mt-4 h-6 w-2/3 rounded-full bg-stone-200" />
          <div className="mt-3 h-4 w-full rounded-full bg-stone-200" />
          <div className="mt-2 h-4 w-4/5 rounded-full bg-stone-200" />
          <div className="mt-5 h-12 rounded-full bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

export default function CustomerProductGrid({
  loading,
  products,
  baristas,
  selectedCategoryName,
  isFiltering = false,
  onProductClick,
}: CustomerProductGridProps) {
  if (loading || isFiltering) {
    return <ProductGridSkeleton />;
  }

  if (products.length === 0) {
    return (
      <div
        data-aos="fade-up"
        className="flex min-h-[24rem] items-center justify-center rounded-[2rem] border border-dashed border-stone-300 bg-white/75 p-8 text-center text-sm text-stone-500"
      >
        No items match your search in {selectedCategoryName}.
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
          const unavailable =
            product.category?.station === "BARISTA" && baristas.length === 0;

          return (
            <ProductCard
              key={product.id}
              product={product}
              unavailable={unavailable}
              onProductClick={onProductClick}
            />
          );
        })}
    </div>
  );
}
