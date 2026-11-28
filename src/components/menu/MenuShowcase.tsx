"use client";

import Link from "next/link";
import ProductCard from "@/components/menu/MenuProductCard";
import FeaturedCard from "@/components/menu/FeaturedCard";
import { Button } from "@/components/ui/button";

import { useReducer } from "react";

import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";
import type { MenuData, MenuProduct } from "@/types/menu/menu-types";

type MenuShowcaseProps = {
  data: MenuData;
};

const INITIAL_CATEGORY_ITEMS = 10;

const LOAD_MORE_ITEMS = 6;

type MenuShowcaseState = {
  selectedCategory: string;
  openedCategories: Set<string>;
  visibleCounts: Record<string, number>;
};

type MenuShowcaseAction =
  { type: "categoryOpened"; categoryId: string } | { type: "productsLoaded"; categoryId: string };

function createMenuShowcaseState(firstCategoryId: string): MenuShowcaseState {
  return {
    selectedCategory: firstCategoryId,
    openedCategories: new Set(firstCategoryId ? [firstCategoryId] : []),
    visibleCounts: firstCategoryId ? { [firstCategoryId]: INITIAL_CATEGORY_ITEMS } : {},
  };
}

function menuShowcaseReducer(
  state: MenuShowcaseState,
  action: MenuShowcaseAction,
): MenuShowcaseState {
  switch (action.type) {
    case "categoryOpened": {
      return {
        ...state,
        selectedCategory: action.categoryId,
        openedCategories: new Set(state.openedCategories).add(action.categoryId),
        visibleCounts: {
          ...state.visibleCounts,
          [action.categoryId]: state.visibleCounts[action.categoryId] ?? INITIAL_CATEGORY_ITEMS,
        },
      };
    }
    case "productsLoaded": {
      return {
        ...state,
        visibleCounts: {
          ...state.visibleCounts,
          [action.categoryId]:
            (state.visibleCounts[action.categoryId] ?? INITIAL_CATEGORY_ITEMS) + LOAD_MORE_ITEMS,
        },
      };
    }
    default:
      return state;
  }
}

export default function MenuShowcase({ data }: MenuShowcaseProps) {
  const hasFeaturedItems = data.featuredItems.length > 0;

  const firstCategoryId = data.categories[0]?.id ?? "";

  const [menuState, dispatchMenuState] = useReducer(
    menuShowcaseReducer,
    firstCategoryId,
    createMenuShowcaseState,
  );

  const selectedCategoryData =
    data.categories.find((category) => category.id === menuState.selectedCategory) ??
    data.categories[0];

  const selectedCategoryProducts =
    selectedCategoryData && menuState.openedCategories.has(selectedCategoryData.id)
      ? selectedCategoryData.products
      : [];

  const visibleProductCount = selectedCategoryData
    ? (menuState.visibleCounts[selectedCategoryData.id] ?? INITIAL_CATEGORY_ITEMS)
    : 0;

  const visibleProducts = selectedCategoryProducts.slice(0, visibleProductCount);

  const remainingProductCount = Math.max(
    selectedCategoryProducts.length - visibleProducts.length,
    0,
  );

  function openCategory(categoryId: string) {
    dispatchMenuState({ type: "categoryOpened", categoryId });
  }

  function loadMoreProducts() {
    if (!selectedCategoryData) {
      return;
    }

    dispatchMenuState({
      type: "productsLoaded",
      categoryId: selectedCategoryData.id,
    });
  }

  return (
    <>
      <MenuCategoryTabs
        categories={data.categories}
        selectedCategory={menuState.selectedCategory}
        onOpenCategory={openCategory}
      />

      <MenuProductSection
        visibleProducts={visibleProducts}
        remainingProductCount={remainingProductCount}
        onLoadMore={loadMoreProducts}
      />

      {hasFeaturedItems ? <FeaturedSection items={data.featuredItems} /> : null}
    </>
  );
}

function MenuCategoryTabs({
  categories,
  selectedCategory,
  onOpenCategory,
}: {
  categories: MenuData["categories"];
  selectedCategory: string;
  onOpenCategory: (slug: string) => void;
}) {
  const t = useCustomerTranslations();
  return (
    <section className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="border-border bg-card rounded-[32px] border px-4 py-5 shadow-[0_24px_70px_rgba(61,35,17,0.08)] sm:px-6">
        <div className="flex flex-wrap gap-3 md:justify-center">
          {categories.length > 0 ? (
            categories.map((category) => {
              const active = selectedCategory === category.id;

              return (
                <Button
                  key={category.id}
                  type="button"
                  variant="ghost"
                  aria-pressed={active}
                  onClick={() => onOpenCategory(category.id)}
                  className={`relative rounded-full px-5 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <span className="relative">{category.name}</span>
                </Button>
              );
            })
          ) : (
            <p className="text-muted-foreground px-2 py-3 text-sm font-medium">
              {t("menuWillAppear")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function MenuProductSection({
  visibleProducts,
  remainingProductCount,
  onLoadMore,
}: {
  visibleProducts: MenuProduct[];
  remainingProductCount: number;
  onLoadMore: () => void;
}) {
  const t = useCustomerTranslations();
  return (
    <section id="menu-grid" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="text-center">
        <p className="text-muted-foreground text-sm font-semibold tracking-[0.3em] uppercase">
          {t("exploreOurMenu")}
        </p>
        <h2
          className="text-foreground mt-4 text-4xl sm:text-5xl"
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          {t("whatWeServe")}
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base leading-7 sm:text-lg">
          {t("serveDescription")}
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProducts.length > 0 ? (
          visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)
        ) : (
          <div className="border-border bg-card/80 rounded-[28px] border p-8 text-center shadow-[0_18px_46px_rgba(67,39,20,0.06)] sm:col-span-2 lg:col-span-3">
            <p
              className="text-foreground text-3xl"
              style={{
                fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
              }}
            >
              {t("menuUpdating")}
            </p>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-7 sm:text-base">
              {t("menuEmpty")}
            </p>
            <Link
              prefetch={false}
              href="/customer"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex rounded-full px-5 py-3 text-sm font-semibold transition"
            >
              {t("orderNow")}
            </Link>
          </div>
        )}
      </div>
      {remainingProductCount > 0 ? (
        <div className="mt-10 flex justify-center">
          <Button
            type="button"
            onClick={onLoadMore}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-5 text-sm font-bold shadow-[0_16px_34px_rgba(42,23,13,0.16)] transition"
          >
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function FeaturedSection({ items }: { items: MenuData["featuredItems"] }) {
  const t = useCustomerTranslations();
  return (
    <section id="featured" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
      <div className="border-border dark:bg-card rounded-[36px] border bg-[linear-gradient(135deg,#f3e3d0_0%,#f9f2e9_52%,#efe0cb_100%)] px-6 py-8 shadow-[0_24px_70px_rgba(61,35,17,0.08)] sm:px-8 lg:px-10 lg:py-10 dark:bg-none">
        <div className="grid gap-8 xl:grid-cols-[290px_minmax(0,1fr)] xl:items-center">
          <div>
            <p className="text-muted-foreground text-center text-lg font-semibold tracking-[0.3em] uppercase">
              {t("ourFavorites")}
            </p>
            <h2
              className="text-foreground mt-4 text-center text-5xl"
              style={{
                fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
              }}
            >
              {t("customerFavorites")}
            </h2>
            <p className="text-md text-muted-foreground mt-6 text-center leading-7">
              {t("favoritesDescription")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item, index) => (
              <FeaturedCard key={item.id} item={item} index={index} />
            ))}
          </div>
          <Link
            prefetch={false}
            href="/customer"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
          >
            {t("orderNow")}
          </Link>
        </div>
      </div>
    </section>
  );
}
