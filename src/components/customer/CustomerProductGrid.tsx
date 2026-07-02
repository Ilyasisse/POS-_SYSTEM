"use client";

import { Button } from "@/components/ui/button";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product, StaffSummary } from "@/lib/types";
import {
  formatCurrency,
  getProductImage,
  getProductModifierGroups,
  hasProductImage,
} from "./customer-order-utils";

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
  const modifierGroups = getProductModifierGroups(product);
  const ctaLabel = modifierGroups.length > 0 ? "Customize" : "Add";
  const hasImage = hasProductImage(product);

  return (
    <Card
      data-aos="fade-up"
      className="gap-0 overflow-hidden rounded-[1.25rem] border border-border/80 bg-card py-0 shadow-[0_18px_45px_rgba(44,28,17,0.11)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(44,28,17,0.16)] sm:rounded-[1.5rem]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,#fbf7ef_0%,#ece0d1_48%,#d9b980_100%)]">
        {hasImage ? (
          <>
            <Image
              src={getProductImage(product)}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
              unoptimized
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,10,8,0.02)_18%,rgba(20,14,10,0.08)_56%,rgba(20,14,10,0.78)_100%)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.88)_0%,rgba(249,239,219,0.78)_50%,rgba(177,117,44,0.26)_100%)]" />
            <div className="absolute left-5 top-5 h-16 w-16 rounded-2xl border border-white/80 bg-card/75 p-2 shadow-[0_14px_30px_rgba(44,28,17,0.12)]">
              <Image
                src="/newer_logo.png"
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="absolute right-5 top-20 h-px w-24 rotate-[-18deg] bg-stone-900/10" />
            <div className="absolute bottom-14 right-5 rounded-full border border-amber-900/10 bg-card/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-foreground backdrop-blur-sm">
              Freshly made
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,14,10,0)_24%,rgba(20,14,10,0.08)_56%,rgba(20,14,10,0.72)_100%)]" />
          </>
        )}
        <div className="absolute right-3 top-3 flex max-w-[70%] flex-wrap justify-end gap-2 sm:right-4 sm:top-4">
          <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
            {product.category?.name ?? "Menu"}
          </span>
          {product.isPopular ? (
            <span className="rounded-full border border-amber-200/30 bg-amber-300/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-50">
              Popular
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 text-white sm:inset-x-4 sm:bottom-4 sm:gap-4">
          <div>
            <h3
              className="text-2xl leading-tight sm:text-3xl"
              style={{
                fontFamily:
                  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
              }}
            >
              {product.name}
            </h3>
          </div>
          <div className="rounded-full border border-white/15 bg-black/25 px-3 py-2 text-sm font-semibold backdrop-blur-sm sm:px-4">
            {formatCurrency(Number(product.price))}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <p className="min-h-0 text-sm leading-6 text-muted-foreground sm:min-h-12">
          {product.description?.trim() ||
            "Freshly prepared with a warm cafe finish and ready to customize."}
        </p>

        <div className="flex flex-wrap gap-2">
          {modifierGroups.length > 0 ? (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
              {modifierGroups.length} option group
              {modifierGroups.length > 1 ? "s" : ""}
            </span>
          ) : null}
          {unavailable ? (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              Temporarily unavailable
            </span>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={() => onProductClick(product)}
          disabled={unavailable}
          className="w-full rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 sm:py-3.5"
        >
          {ctaLabel}
        </Button>
      </div>
    </Card>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="gap-3 p-4">
          <Skeleton className="aspect-[4/3] w-full rounded-[1.25rem]" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-12 w-full" />
        </Card>
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
        className="flex min-h-[24rem] items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/75 p-8 text-center text-sm text-muted-foreground"
      >
        No items match your search in {selectedCategoryName}.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
