"use client";

import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryChip } from "@/types/customer-order.types";
import { displayFont } from "../customer-order-styles";

type MenuBrowserPanelProps = {
  searchTerm: string;
  categoryChips: CategoryChip[];
  selectedCategory: string;
  onSearchChange: (searchTerm: string) => void;
  onCategorySelect: (categoryId: string) => void;
};

export default function MenuBrowserPanel({
  searchTerm,
  categoryChips,
  selectedCategory,
  onSearchChange,
  onCategorySelect,
}: MenuBrowserPanelProps) {
  const t = useCustomerTranslations();
  return (
    <section
      data-aos="zoom-in"
      data-aos-delay="100"
      className="border-border bg-card/88 mt-4 rounded-[1.25rem] border p-4 shadow-[0_22px_65px_rgba(44,28,17,0.12)] backdrop-blur-xl sm:mt-5 sm:rounded-[1.75rem] sm:p-5"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-muted-foreground text-xs tracking-[0.28em] uppercase">
            {t("browseCategory")}
          </p>
          <h2
            className="text-foreground mt-2 text-2xl sm:text-4xl"
            style={{ fontFamily: displayFont }}
          >
            {t("pickSection")}
          </h2>
        </div>

        <div className="w-full lg:max-w-md">
          <label className="sr-only" htmlFor="menu-search">
            {t("searchMenu")}
          </label>
          <Input
            id="menu-search"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-card w-full rounded-full border px-5 py-3.5 text-sm shadow-inner outline-none focus:border-amber-600"
          />
        </div>
      </div>

      <div className="mt-5 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:gap-3">
        {categoryChips.map((category) => {
          const active = selectedCategory === category.id;

          return (
            <Button
              key={category.id}
              type="button"
              variant="outline"
              aria-pressed={active}
              onClick={() => onCategorySelect(category.id)}
              className={`min-w-28 snap-start rounded-full px-4 py-3 text-left text-sm font-semibold transition sm:min-w-32 sm:px-5 ${
                active
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:bg-primary dark:hover:bg-primary/90 shadow-sm"
                  : "border-border bg-card text-foreground hover:border-ring hover:bg-accent hover:text-accent-foreground dark:bg-card dark:hover:bg-accent border"
              }`}
            >
              <div>{category.id === "all" ? t("all") : category.name}</div>
              <div
                className={`mt-1 text-[11px] tracking-[0.18em] uppercase ${
                  active ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                {t("itemCount", { count: category.count })}
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
