"use client";

import Image from "next/image";
// Next.js component used for page navigation without full page reload
import Link from "next/link";

// React hooks for state management and lifecycle events
import { useEffect, useLayoutEffect, useReducer, useState } from "react";

// Custom hook used to refresh AOS animations when content changes
import { useAos } from "@/components/AosInitializer";

// TypeScript types for menu data and products
import type { MenuData, MenuProduct } from "@/lib/menu/menu-data";

// Props type for the MenuShowcase component
type MenuShowcaseProps = {
  // Complete menu data passed into this component
  data: MenuData;
};




// Initial number of products visible when category first opens
const INITIAL_CATEGORY_ITEMS = 10;

// Number of extra products shown after clicking "Load More"
const LOAD_MORE_ITEMS = 6;

type MenuShowcaseState = {
  selectedCategory: string;
  openedCategories: Set<string>;
  visibleCounts: Record<string, number>;
  mobileNavOpen: boolean;
};

type MenuShowcaseAction =
  | { type: "categoryOpened"; slug: string }
  | { type: "productsLoaded"; slug: string }
  | { type: "mobileNavToggled" }
  | { type: "mobileNavClosed" };

function createMenuShowcaseState(firstCategorySlug: string): MenuShowcaseState {
  return {
    selectedCategory: firstCategorySlug,
    openedCategories: new Set(firstCategorySlug ? [firstCategorySlug] : []),
    visibleCounts: firstCategorySlug
      ? { [firstCategorySlug]: INITIAL_CATEGORY_ITEMS }
      : {},
    mobileNavOpen: false,
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
        selectedCategory: action.slug,
        openedCategories: new Set(state.openedCategories).add(action.slug),
        visibleCounts: {
          ...state.visibleCounts,
          [action.slug]:
            state.visibleCounts[action.slug] ?? INITIAL_CATEGORY_ITEMS,
        },
      };
    }
    case "productsLoaded": {
      return {
        ...state,
        visibleCounts: {
          ...state.visibleCounts,
          [action.slug]:
            (state.visibleCounts[action.slug] ?? INITIAL_CATEGORY_ITEMS) +
            LOAD_MORE_ITEMS,
        },
      };
    }
    case "mobileNavToggled": {
      return {
        ...state,
        mobileNavOpen: !state.mobileNavOpen,
      };
    }
    case "mobileNavClosed": {
      return {
        ...state,
        mobileNavOpen: false,
      };
    }
    default:
      return state;
  }
}

function isPastScrollOffset(offset: number) {
  return typeof window !== "undefined" && window.scrollY > offset;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}




// Component used to display a single product card
import ProductCard from "@/components/menu/MenuProductCard";


// Component used to display featured menu items
import FeaturedCard from "@/components/menu/FeaturedCard";


// Main menu showcase page component
export default function MenuShowcase({ data }: MenuShowcaseProps) {



  const hasFeaturedItems = data.featuredItems.length > 0;

  // Gets the slug of the first category for default selection
  const firstCategorySlug = data.categories[0]?.slug ?? "";

  const [menuState, dispatchMenuState] = useReducer(
    menuShowcaseReducer,
    firstCategorySlug,
    createMenuShowcaseState,
  );

  // Controls visibility of back-to-top button
  const [showBackToTop, setShowBackToTop] = useState(() =>
    isPastScrollOffset(620),
  );

  // Finds currently selected category object
  const selectedCategoryData =
    data.categories.find(
      (category) => category.slug === menuState.selectedCategory,
    ) ??
    data.categories[0];

  // Gets products from currently selected category
  const selectedCategoryProducts =
    selectedCategoryData &&
    menuState.openedCategories.has(selectedCategoryData.slug)
      ? selectedCategoryData.products
      : [];

  // Gets number of products currently visible
  const visibleProductCount = selectedCategoryData
    ? (menuState.visibleCounts[selectedCategoryData.slug] ??
      INITIAL_CATEGORY_ITEMS)
    : 0;

  // Creates sliced array containing only visible products
  const visibleProducts = selectedCategoryProducts.slice(
    0,
    visibleProductCount,
  );

  // Calculates how many products are left hidden
  const remainingProductCount = Math.max(
    selectedCategoryProducts.length - visibleProducts.length,
    0,
  );

  // Opens selected category and initializes visible product count
  function openCategory(slug: string) {
    dispatchMenuState({ type: "categoryOpened", slug });
  }

  // Loads additional products into currently selected category
  function loadMoreProducts() {
    // Stops function if no category selected
    if (!selectedCategoryData) {
      return;
    }

    dispatchMenuState({
      type: "productsLoaded",
      slug: selectedCategoryData.slug,
    });
  }

  // Forces menu page refreshes/restores to start from the top
  useLayoutEffect(() => {
    const canControlScrollRestoration = "scrollRestoration" in window.history;
    const previousScrollRestoration = canControlScrollRestoration
      ? window.history.scrollRestoration
      : undefined;

    function resetScrollPosition() {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    if (canControlScrollRestoration) {
      window.history.scrollRestoration = "manual";
    }

    resetScrollPosition();
    window.addEventListener("pageshow", resetScrollPosition);

    return () => {
      window.removeEventListener("pageshow", resetScrollPosition);

      if (previousScrollRestoration) {
        window.history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, []);

  // Handles scroll events for showing back-to-top button
  useEffect(() => {
    // Checks scroll position
    function handleScroll() {
      // Shows button after user scrolls down 620px
      setShowBackToTop(isPastScrollOffset(620));
    }

    // Adds scroll event listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Cleanup function removes event listener
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Refreshes AOS animations when menu products change
  useAos(visibleProducts.length, menuState.selectedCategory);

  return (
    <main className="min-h-screen bg-[#f7efe6] text-[#2f180d]">
      <MenuHeader
        cafeName={data.cafeName}
        mobileNavOpen={menuState.mobileNavOpen}
        onCloseMobileNav={() =>
          dispatchMenuState({ type: "mobileNavClosed" })
        }
        onToggleMobileNav={() =>
          dispatchMenuState({ type: "mobileNavToggled" })
        }
      />

      <MenuHero heroImage={data.heroImage} />

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

      <MenuFooter cafeName={data.cafeName} />

      {showBackToTop && !menuState.mobileNavOpen ? (
        <BackToTopButton onClick={scrollToTop} />
      ) : null}
    </main>
  );
}

function MenuHeader({
  cafeName,
  mobileNavOpen,
  onCloseMobileNav,
  onToggleMobileNav,
}: {
  cafeName: string;
  mobileNavOpen: boolean;
  onCloseMobileNav: () => void;
  onToggleMobileNav: () => void;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#120906]/74 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header data-aos="fade-down" className="py-3">
          <div className="flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/6 px-4 py-4 md:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#e4b06d] shadow-[0_16px_36px_rgba(11,6,3,0.28)]">
                <Image
                  src="/newer_logo.png"
                  alt={cafeName}
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="truncate text-sm uppercase tracking-[0.34em] text-[#f3d9b9]">
                  {cafeName}
                </p>
                <p className="text-sm text-white/70"></p>
              </div>
            </div>

            <nav className="hidden items-center gap-2 text-sm font-medium text-white/78 md:flex">
              <Link
                href="/"
                className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
              >
                Home
              </Link>
              <Link
                href="/menu"
                className="rounded-full border border-[#d7aa6a]/60 bg-[#d7aa6a]/12 px-4 py-2 text-white"
              >
                Menu
              </Link>

              <Link
                href="#contact"
                className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
              >
                Contact
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/customer"
                className="hidden items-center justify-center rounded-full bg-[#d09a59] px-5 py-3 text-sm font-semibold text-[#231208] shadow-[0_14px_30px_rgba(208,154,89,0.25)] transition hover:bg-[#deab6d] md:inline-flex"
              >
                Order Now
              </Link>

              <button
                type="button"
                onClick={onToggleMobileNav}
                aria-expanded={mobileNavOpen}
                aria-label="Toggle navigation"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/12 md:hidden"
              >
                <span className="flex flex-col gap-1.5">
                  <span
                    className={`h-0.5 w-5 rounded-full bg-current transition ${mobileNavOpen ? "translate-y-2 rotate-45" : ""}`}
                  />
                  <span
                    className={`h-0.5 w-5 rounded-full bg-current transition ${mobileNavOpen ? "opacity-0" : ""}`}
                  />
                  <span
                    className={`h-0.5 w-5 rounded-full bg-current transition ${mobileNavOpen ? "-translate-y-2 -rotate-45" : ""}`}
                  />
                </span>
              </button>
            </div>
          </div>

          {mobileNavOpen ? (
            <div
              data-aos="fade-down"
              data-aos-duration="180"
              className="mt-3 rounded-[24px] border border-white/10 bg-[#1a0d08]/95 p-3 text-white shadow-[0_20px_50px_rgba(12,7,4,0.32)] md:hidden"
            >
              <div className="grid gap-2">
                <Link
                  href="/"
                  onClick={onCloseMobileNav}
                  className="rounded-[18px] px-4 py-3 text-sm font-medium transition"
                >
                  Home
                </Link>
                <Link
                  href="/menu"
                  onClick={onCloseMobileNav}
                  className="rounded-[18px] border border-[#d7aa6a]/30 bg-[#d7aa6a]/12 px-4 py-3 text-sm font-medium text-white"
                >
                  Menu
                </Link>

                <Link
                  href="#contact"
                  onClick={onCloseMobileNav}
                  className="rounded-[18px] px-4 py-3 text-sm font-medium transition"
                >
                  Contact
                </Link>
                <Link
                  href="/customer"
                  onClick={onCloseMobileNav}
                  className="mt-1 inline-flex items-center justify-center rounded-[18px] bg-[#d09a59] px-4 py-3 text-sm font-semibold text-[#231208] shadow-[0_14px_30px_rgba(208,154,89,0.25)] transition "
                >
                  Order Now
                </Link>
              </div>
            </div>
          ) : null}
        </header>
      </div>
    </div>
  );
}

function MenuHero({ heroImage }: { heroImage: string }) {
  return (
    <section className="relative isolate min-h-[560px] overflow-hidden bg-[#120906] pt-28 text-white sm:min-h-[620px] sm:pt-32 lg:min-h-[680px] xl:min-h-[720px]">
      <div className="absolute inset-0 -z-10">
        <Image
          src={heroImage}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          unoptimized
          className="h-full w-full object-cover object-[57%_center] sm:object-center lg:object-[50%_center]"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(14,7,4,0.88)_0%,rgba(14,7,4,0.72)_48%,rgba(14,7,4,0.52)_100%)] sm:bg-[linear-gradient(90deg,rgba(14,7,4,0.92)_0%,rgba(14,7,4,0.76)_44%,rgba(14,7,4,0.40)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(231,177,110,0.22),transparent_34%)]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-24">
        <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:pt-20">
          <div data-aos="fade-up" className="max-w-3xl">
            <h1
              className="mt-0 text-5xl leading-none text-[#fff7ef] sm:text-6xl lg:text-7xl"
              style={{
                fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
              }}
            >
              Our Menu
            </h1>
            <p className="mt-4 max-w-2xl text-[14px] leading-7 text-white/80 sm:text-xl">
              Fresh coffee, tasty food, and refreshing drinks made for you.
            </p>
            <p className="mt-4 max-w-2xl text-[12px] leading-7 text-white/60 sm:text-base">
              Take a look at our menu, find your favorites, and order when
              you’re ready.
            </p>

            <div className="mt-8 flex flex-wrap gap-4  ">
              <Link
                href="#menu-grid"
                className="rounded-full bg-white px-6 py-3.5 text-md tracking-widest font-semibold text-[#24140c] transition hover:bg-[#f8efe4] w-full text-center sm:max-w-[60%] "
              >
                Explore Menu
              </Link>
              <Link
                href="/customer"
                className="rounded-full border border-white/16 tracking-widest uppercerase bg-white/6 px-6 py-3.5 text-xl font-semibold text-white transition hover:bg-white/12 w-full text-center sm:max-w-[60%] "
              >
                Order Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
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
  return (
    <section className="relative z-10 -mt-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-[#ead8c6] bg-[#fbf6ef] px-4 py-5 shadow-[0_24px_70px_rgba(61,35,17,0.08)] sm:px-6">
        <div className="flex flex-wrap gap-3">
          {categories.length > 0 ? (
            categories.map((category) => {
              const active = selectedCategory === category.slug;

              return (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => onOpenCategory(category.slug)}
                  className={`relative rounded-full px-5 py-3 text-sm font-semibold transition ${
                    active
                      ? "text-white"
                      : "text-[#5f4637] hover:bg-[#f3e5d5]"
                  }`}
                >
                  {active ? (
                    <span className="absolute inset-0 rounded-full bg-[#2a170d]" />
                  ) : null}
                  <span className="relative">{category.name}</span>
                </button>
              );
            })
          ) : (
            <p className="px-2 py-3 text-sm font-medium text-[#6f5748]">
              Menu items will appear here when active products are available.
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
  return (
    <section
      id="menu-grid"
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
    >
      <div data-aos="fade-up" className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b07b45]">
          Explore our menu
        </p>
        <h2
          className="mt-4 text-4xl text-[#2f180d] sm:text-5xl"
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          What We Serve
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#7b6557] sm:text-lg">
          From warm drinks to fresh meals and sweet treats, explore something
          delicious made just for you.
        </p>
      </div>

      <div className="mt-10 grid sm:grid-cols-2 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {visibleProducts.length > 0 ? (
          visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="rounded-[28px] border border-[#ead8c6] bg-white/80 p-8 text-center shadow-[0_18px_46px_rgba(67,39,20,0.06)] md:col-span-2 xl:col-span-3">
            <p
              className="text-3xl text-[#2f180d]"
              style={{
                fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
              }}
            >
              Menu updating
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#7b6557] sm:text-base">
              No active menu products are available right now. Please check
              back soon or place an order from the customer screen.
            </p>
            <Link
              href="/customer"
              className="mt-6 inline-flex rounded-full bg-[#2a170d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3d2417]"
            >
              Order Now
            </Link>
          </div>
        )}
      </div>
      {remainingProductCount > 0 ? (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-full bg-[#2a170d] px-8 py-5 text-sm font-bold text-white shadow-[0_16px_34px_rgba(42,23,13,0.16)] transition hover:bg-[#3d2417]"
          >
            Load More
          </button>
        </div>
      ) : null}
    </section>
  );
}

function FeaturedSection({ items }: { items: MenuData["featuredItems"] }) {
  return (
    <section
      id="featured"
      className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20"
    >
      <div className="rounded-[36px] border border-[#ead8c6] bg-[linear-gradient(135deg,#f3e3d0_0%,#f9f2e9_52%,#efe0cb_100%)] px-6 py-8 shadow-[0_24px_70px_rgba(61,35,17,0.08)] sm:px-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[290px_minmax(0,1fr)] lg:items-center">
          <div data-aos="fade-right">
            <p className="text-lg font-semibold uppercase tracking-[0.3em] text-[#b07b45] text-center">
              Our favorites
            </p>
            <h2
              className="mt-4 text-5xl text-[#2f180d] text-center"
              style={{
                fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
              }}
            >
              Customer Favorites
            </h2>
            <p className="mt-6 text-md leading-7 text-[#715b4d] text-center">
              Discover the dishes, drinks, and cafe classics our customers love
              the most.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item, index) => (
              <FeaturedCard key={item.id} item={item} index={index} />
            ))}
          </div>
          <Link
            href="/customer"
            className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-[#2a170d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3d2417]"
          >
            Order Now
          </Link>
        </div>
      </div>
    </section>
  );
}

function MenuFooter({ cafeName }: { cafeName: string }) {
  return (
    <footer id="contact" className="bg-[#201108] text-[#f8eee3]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#d09a59]">
              <Image
                src="/newer_logo.png"
                alt={cafeName}
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-[#f0d4ae]">
                {cafeName}
              </p>
              <p className="text-sm text-white/65">
                Warm coffee, quality food, and daily comfort.
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/62">
            Fresh meals, warm drinks, and daily comfort served with care.
          </p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">Address</p>
          <p className="mt-4 text-md leading-7 text-white/68">
            Jidka Airport Bosaso
          </p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">Contact</p>
          <p className="mt-4 text-sm leading-7 text-white/68">
            +252 90 7796071
          </p>
        </div>

        <div>
          <p className="text-lg font-semibold text-white">Opening Hours</p>
          <p className="mt-4 text-sm leading-7 text-white/68">
            Saturday - Friday: 7:00 AM - 2:00 AM
          </p>
        </div>
      </div>
    </footer>
  );
}

function BackToTopButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#f4dcc2]/50 bg-[#201108] text-[#fff6ec] shadow-[0_18px_45px_rgba(32,17,8,0.35)] transition hover:-translate-y-0.5 hover:bg-[#3d2417] focus:outline-none focus:ring-2 focus:ring-[#d09a59] focus:ring-offset-2 sm:bottom-7 sm:right-7 sm:h-14 sm:w-14"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}
