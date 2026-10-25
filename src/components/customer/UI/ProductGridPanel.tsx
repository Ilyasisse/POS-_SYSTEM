"use client";

import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";
import React from "react";
import CustomerProductGrid from "../CustomerProductGrid";
import { Product } from "@/types";
import { StaffSummary } from "@/types";
import { displayFont } from "../customer-order-styles";

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
  const t = useCustomerTranslations();
  return (
    <section
      data-aos="fade-up"
      data-aos-delay="100"
      className="border-border bg-card/84 mt-4 rounded-[1.25rem] border p-4 shadow-[0_22px_65px_rgba(44,28,17,0.12)] backdrop-blur-xl sm:mt-5 sm:rounded-[1.75rem] sm:p-5"
    >
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div>
          <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
            {t("productGrid")}
          </p>
          <h2
            className="text-foreground mt-2 text-2xl sm:text-3xl"
            style={{ fontFamily: displayFont }}
          >
            {selectedCategoryName}
          </h2>
        </div>
        <div className="border-border bg-card text-foreground rounded-full border px-4 py-2 text-sm font-medium shadow-sm">
          {t("itemCount", { count: filteredProducts.length })}
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
