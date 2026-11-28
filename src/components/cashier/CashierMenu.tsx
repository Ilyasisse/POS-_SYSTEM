"use client";
import Image from "next/image";
import type { Product, StaffSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getProductImage,
  hasProductImage,
  getProductModifierGroups,
} from "@/components/customer/customer-order-utils";

export default function CashierMenu({
  search,
  onSearch,
  categories,
  category,
  onCategory,
  products,
  baristas,
  loading,
  disabled,
  onAdd,
}: {
  search: string;
  onSearch: (value: string) => void;
  categories: { id: string; name: string; count: number }[];
  category: string;
  onCategory: (value: string) => void;
  products: Product[];
  baristas: StaffSummary[];
  loading: boolean;
  disabled: boolean;
  onAdd: (product: Product) => void;
}) {
  return (
    <section aria-label="Order menu" className="min-w-0 space-y-4">
      <div className="bg-card rounded-2xl border p-4">
        <label className="text-sm font-semibold">
          Search products
          <Input
            className="mt-2 min-h-11"
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search the menu"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2" aria-label="Product categories">
          {categories.map((item) => (
            <Button
              key={item.id}
              variant={category === item.id ? "default" : "outline"}
              className="min-h-11 shrink-0"
              aria-pressed={category === item.id}
              onClick={() => onCategory(item.id)}
            >
              {item.name} ({item.count})
            </Button>
          ))}
        </div>
      </div>
      <p role="status" className="text-muted-foreground text-sm">
        {loading ? "Loading products…" : `${products.length} products · tap Add or Customize`}
      </p>
      {!loading && !products.length ? (
        <p className="bg-card rounded-2xl border border-dashed p-6 text-sm">
          No products match this search and category.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {products.map((product) => {
          const unavailable = product.category?.station === "BARISTA" && !baristas.length;
          const customized = getProductModifierGroups(product).length > 0;
          return (
            <article
              key={product.id}
              className="bg-card flex min-w-0 flex-col gap-3 rounded-2xl border p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                {hasProductImage(product) ? (
                  <Image
                    src={getProductImage(product)}
                    alt=""
                    width={64}
                    height={64}
                    sizes="64px"
                    unoptimized
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold break-words">{product.name}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">{product.category?.name}</p>
                  <p className="mt-1 font-semibold tabular-nums">
                    ${Number(product.price).toFixed(2)}
                  </p>
                </div>
              </div>
              {unavailable ? (
                <p className="text-muted-foreground text-sm">Barista unavailable</p>
              ) : null}
              <Button
                className="mt-auto min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"
                aria-label={`${customized ? "Customize" : "Add"} ${product.name}`}
                disabled={disabled || loading || unavailable}
                onClick={() => onAdd(product)}
              >
                {customized ? "Customize" : "Add"}
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
