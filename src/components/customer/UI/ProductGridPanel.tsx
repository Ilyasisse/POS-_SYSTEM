import React from "react";
import CustomerProductGrid from "../CustomerProductGrid";
import { Product } from "@/types";
import { StaffSummary } from "@/types";
import { displayFont } from "../CustomerOrderPage";

type ProductGridPanelProps = {
  loading: boolean;
  filteredProducts: Product[];
  baristas: StaffSummary[];
  selectedCategoryName: string;
  isFiltering: boolean;
  onProductClick: (product: Product) => void;
};

export default function ProductGridPanel({
  loading,
  filteredProducts,
  baristas,
  selectedCategoryName,
  isFiltering,
  onProductClick,
}: ProductGridPanelProps) {
  return (
    <section
      data-aos="fade-up"
      data-aos-delay="100"
      className="mt-4 rounded-[1.25rem] border border-white/80 bg-card/84 p-4 shadow-[0_22px_65px_rgba(44,28,17,0.12)] backdrop-blur-xl sm:mt-5 sm:rounded-[1.75rem] sm:p-5"
    >
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Product grid
          </p>
          <h2
            className="mt-2 text-2xl text-foreground sm:text-3xl"
            style={{ fontFamily: displayFont }}
          >
            {selectedCategoryName}
          </h2>
        </div>
        <div className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
          {filteredProducts.length} item
          {filteredProducts.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl xl:max-w-none">
        <CustomerProductGrid
          loading={loading}
          products={filteredProducts}
          baristas={baristas}
          selectedCategoryName={selectedCategoryName}
          isFiltering={isFiltering}
          onProductClick={onProductClick}
        />
      </div>
    </section>
  );
}
