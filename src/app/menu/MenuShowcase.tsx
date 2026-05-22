"use client";

// Next.js component used for page navigation without full page reload
import Link from "next/link";

// React hooks for state management and lifecycle events
import { useEffect, useState } from "react";

// Custom hook used to refresh AOS animations when content changes
import { useAos } from "../components/AosInitializer";

// TypeScript types for menu data and products
import type { MenuData, MenuProduct } from "./menu-data";

// Props type for the MenuShowcase component
type MenuShowcaseProps = {
  // Complete menu data passed into this component
  data: MenuData;
};

// Currency formatter used to display prices in USD format
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Initial number of products visible when category first opens
const INITIAL_CATEGORY_ITEMS = 9;

// Number of extra products shown after clicking "Load More"
const LOAD_MORE_ITEMS = 6;

// Converts a number into formatted USD currency text
function formatPrice(value: number) {
  return currencyFormatter.format(value);
}

// Component used to display a single product card
function ProductCard({ product }: { product: MenuProduct }) {
  return (
    <article
      data-aos="fade-right "
      className="group overflow-hidden rounded-[28px] border border-[#e4d2bf] bg-white/90 shadow-[0_22px_60px_rgba(73,37,16,0.10)]"
    >
      {/* Product image container */}
      <div className="relative aspect-4/3 overflow-hidden bg-[linear-gradient(135deg,#5a3320_0%,#8f5b32_55%,#d4a169_100%)]">
        
        {/* Only show image if product has imageUrl */}
        {product.imageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${product.imageUrl})` }}
          />
        ) : null}

        {/* Dark overlay added on top of image for readability */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,14,7,0.04)_10%,rgba(25,14,7,0.18)_48%,rgba(25,14,7,0.82)_100%)]" >

        {/* Category badge shown on top-right */}
        <span className="absolute right-4 top-4 rounded-full border border-[#f4dcc2]/80 bg-[#6c3f20]/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#fff6ec]">
          {product.categoryName}
        </span>
        </div>
      </div>

      {/* Product content section */}
      <div className="space-y-0.5 p-5 flex flex-col justify-between gap-2 ">
        
        {/* Product name */}
        <h3
          className="text-4xl leading-none sm:text-2xl "
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          {product.name}
        </h3>

        {/* Product description */}
        <p className=" text-sm max-w-[80%] leading-6 text-[#6c5a4f] sm:text-[15px]">
          {product.description}
        </p>

        {/* Product price */}
        <div className="rounded-full px-4 py-2 text-3xl font-semibold text-[#B5651D] ">
          {formatPrice(product.price)}
        </div>
      </div>
    </article>
  );
}

// Component used to display featured menu items
function FeaturedCard({ item, index }: { item: MenuProduct; index: number }) {
  return (
    <article
      data-aos="fade-up"

      // Delays animation slightly for staggered effect
      data-aos-delay={String(index * 60)}

      className="overflow-hidden rounded-[24px] border border-white/50 bg-white/75 shadow-[0_18px_46px_rgba(67,39,20,0.08)] backdrop-blur"
    >
      {/* Featured image section */}
      <div className="aspect-[5/4] overflow-hidden bg-[linear-gradient(135deg,#5a3320_0%,#8f5b32_55%,#d4a169_100%)]">
        
        {/* Only render image if imageUrl exists */}
        {item.imageUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${item.imageUrl})` }}
          />
        ) : null}
      </div>

      {/* Featured item information */}
      <div className="p-4 text-center">
        
        {/* Featured item name */}
        <p
          className="text-2xl text-[#2f180d]"
          style={{
            fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
          }}
        >
          {item.name}
        </p>

        {/* Featured item category */}
        <p className="mt-1 text-sm text-[#8a6a55]">{item.categoryName}</p>

        {/* Featured item price */}
        <p className="mt-3 text-lg font-semibold text-[#b87735]">
          {formatPrice(item.price)}
        </p>
      </div>
    </article>
  );
}

// Main menu showcase page component
export default function MenuShowcase({ data }: MenuShowcaseProps) {

  // Gets the slug of the first category for default selection
  const firstCategorySlug = data.categories[0]?.slug ?? "";

  // Stores currently selected category slug
  const [selectedCategory, setSelectedCategory] = useState(firstCategorySlug);

  // Stores categories that have already been opened
  const [openedCategories, setOpenedCategories] = useState<Set<string>>(
    () => new Set(firstCategorySlug ? [firstCategorySlug] : []),
  );

  // Stores visible product count per category
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>(
    () =>
      firstCategorySlug
        ? { [firstCategorySlug]: INITIAL_CATEGORY_ITEMS }
        : {},
  );

  // Controls mobile navigation open/close state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Controls visibility of back-to-top button
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Finds currently selected category object
  const selectedCategoryData =
    data.categories.find((category) => category.slug === selectedCategory) ??
    data.categories[0];

  // Gets products from currently selected category
  const selectedCategoryProducts =
    selectedCategoryData && openedCategories.has(selectedCategoryData.slug)
      ? selectedCategoryData.products
      : [];

  // Gets number of products currently visible
  const visibleProductCount =
    selectedCategoryData
      ? (visibleCounts[selectedCategoryData.slug] ?? INITIAL_CATEGORY_ITEMS)
      : 0;

  // Creates sliced array containing only visible products
  const visibleProducts = selectedCategoryProducts.slice(0, visibleProductCount);

  // Calculates how many products are left hidden
  const remainingProductCount = Math.max(
    selectedCategoryProducts.length - visibleProducts.length,
    0,
  );

  // Opens selected category and initializes visible product count
  function openCategory(slug: string) {

    // Updates selected category
    setSelectedCategory(slug);

    // Adds category to opened category set
    setOpenedCategories((current) => new Set(current).add(slug));

    // Sets default visible product count if category not already initialized
    setVisibleCounts((current) => ({
      ...current,
      [slug]: current[slug] ?? INITIAL_CATEGORY_ITEMS,
    }));
  }

  // Loads additional products into currently selected category
  function loadMoreProducts() {

    // Stops function if no category selected
    if (!selectedCategoryData) {
      return;
    }

    // Increases visible product count
    setVisibleCounts((current) => ({
      ...current,
      [selectedCategoryData.slug]:
        (current[selectedCategoryData.slug] ?? INITIAL_CATEGORY_ITEMS) +
        LOAD_MORE_ITEMS,
    }));
  }

  // Handles scroll events for showing back-to-top button
  useEffect(() => {

    // Checks scroll position
    function handleScroll() {

      // Shows button after user scrolls down 620px
      setShowBackToTop(window.scrollY > 620);
    }

    // Runs immediately on first render
    handleScroll();

    // Adds scroll event listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Cleanup function removes event listener
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Smoothly scrolls user back to top of page
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Refreshes AOS animations when dependencies change
  useAos([visibleProducts.length, selectedCategory, mobileNavOpen]);

  return (
     <main className="min-h-screen bg-[#f7efe6] text-[#2f180d]">
      <div className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#120906]/74 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header
            data-aos="fade-down"
            className="py-3"
          >
            <div className="flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-white/6 px-4 py-4 md:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#e4b06d] shadow-[0_16px_36px_rgba(11,6,3,0.28)]">
                  <img
                    src="/newer_logo.png"
                    alt={data.cafeName}
                    className="h-9 w-9 object-contain"
                  />
                </div>
                <div className="min-w-0 hidden sm:block">
                  <p className="truncate text-sm uppercase tracking-[0.34em] text-[#f3d9b9]">
                    {data.cafeName}
                  </p>
                  <p className="text-sm text-white/70">
                    
                  </p>
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
                  href="#featured"
                  className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
                >
                  About Us
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
                  onClick={() => setMobileNavOpen((current) => !current)}
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
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-[18px] px-4 py-3 text-sm font-medium transition"
                    >
                      Home
                    </Link>
                    <Link
                      href="/menu"
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-[18px] border border-[#d7aa6a]/30 bg-[#d7aa6a]/12 px-4 py-3 text-sm font-medium text-white"
                    >
                      Menu
                    </Link>
                    <Link
                      href="#featured"
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-[18px] px-4 py-3 text-sm font-medium transition"
                    >
                      About Us
                    </Link>
                    <Link
                      href="#contact"
                      onClick={() => setMobileNavOpen(false)}
                      className="rounded-[18px] px-4 py-3 text-sm font-medium transition"
                    >
                      Contact
                    </Link>
                    <Link
                      href="/customer"
                      onClick={() => setMobileNavOpen(false)}
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

      <section className="relative isolate min-h-[560px] overflow-hidden bg-[#120906] pt-28 text-white sm:min-h-[620px] sm:pt-32 lg:min-h-[680px] xl:min-h-[720px]">
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.heroImage}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[57%_center] sm:object-center lg:object-[50%_center]"
          />
        </div>
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(14,7,4,0.88)_0%,rgba(14,7,4,0.72)_48%,rgba(14,7,4,0.52)_100%)] sm:bg-[linear-gradient(90deg,rgba(14,7,4,0.92)_0%,rgba(14,7,4,0.76)_44%,rgba(14,7,4,0.40)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(231,177,110,0.22),transparent_34%)]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-24">
          <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:pt-20">
            <div
              data-aos="fade-up"
              className="max-w-3xl"
            >
              <div className="inline-flex items-center rounded-full border border-[#e7b171]/35 bg-[#f2d2a5]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#f6d3a6]">
                {data.hasLiveData ? "Live from the POS" : "Curated sample menu"}
              </div>
              <h1
                className="mt-6 text-5xl leading-none text-[#fff7ef] sm:text-6xl lg:text-7xl"
                style={{
                  fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
                }}
              >
                Our Menu
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl">
                Fresh coffee, food, and drinks made daily.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">
                Explore the full cafe selection in a customer-facing with
                warm colors, clear pricing, and polished product cards.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="#menu-grid"
                  className="rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#24140c] transition hover:bg-[#f8efe4]"
                >
                  Explore Menu
                </Link>
                <Link
                  href="/customer"
                  className="rounded-full border border-white/16 bg-white/6 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/12"
                >
                  Order Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-[#ead8c6] bg-[#fbf6ef] px-4 py-5 shadow-[0_24px_70px_rgba(61,35,17,0.08)] sm:px-6">
            <div className="flex flex-wrap gap-3">
              {data.categories.map((category) => {
                const active = selectedCategory === category.slug;

                return (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => openCategory(category.slug)}
                    className={`relative rounded-full px-5 py-3 text-sm font-semibold transition ${
                      active
                        ? "text-white"
                        : "text-[#5f4637] hover:bg-[#f3e5d5]"
                    }`}
                  >
                    {active ? (
                      <span
                        className="absolute inset-0 rounded-full bg-[#2a170d]"
                      />
                    ) : null}
                    <span className="relative">{category.name}</span>
                  </button>
                );
              })}
            </div>
        </div>
      </section>

      <section
        id="menu-grid"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
      >
        <div
          data-aos="fade-up"
          className="text-center"
        >
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
            Large, readable cards make it easy for customers to browse coffee,
            tea, meals, desserts, and cold drinks from any screen size.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
        </div>
        {remainingProductCount > 0 ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={loadMoreProducts}
              className="rounded-full bg-[#2a170d] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(42,23,13,0.16)] transition hover:bg-[#3d2417]"
            >
              Load More
            </button>
          </div>
        ) : null}
      </section>

      <section
        id="featured"
        className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20"
      >
        <div className="rounded-[36px] border border-[#ead8c6] bg-[linear-gradient(135deg,#f3e3d0_0%,#f9f2e9_52%,#efe0cb_100%)] px-6 py-8 shadow-[0_24px_70px_rgba(61,35,17,0.08)] sm:px-8 lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[290px_minmax(0,1fr)] lg:items-center">
            <div
              data-aos="fade-right"
              >
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#b07b45]">
                Our favorites
              </p>
              <h2
                className="mt-4 text-4xl text-[#2f180d]"
                style={{
                  fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
                }}
              >
                Featured Items
              </h2>
              <p className="mt-4 text-base leading-7 text-[#715b4d]">
                A few customer favorites you can place front and center on a
                tablet, TV, or menu kiosk.
              </p>
              <Link
                href="/customer"
                className="mt-6 inline-flex rounded-full bg-[#2a170d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3d2417]"
              >
                Order Now
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.featuredItems.map((item, index) => (
                <FeaturedCard key={item.id} item={item} index={index} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-[#201108] text-[#f8eee3]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#d09a59]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/newer_logo.png"
                  alt={data.cafeName}
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.32em] text-[#f0d4ae]">
                  {data.cafeName}
                </p>
                <p className="text-sm text-white/65">
                  Warm coffee, quality food, and daily comfort.
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/62">
              Built as a clean customer-facing menu page under `/menu`, separate
              from the admin, cashier, waiter, and kitchen screens.
            </p>
          </div>

          <div>
            <p className="text-lg font-semibold text-white">Address</p>
            <p className="mt-4 text-sm leading-7 text-white/68">
              Main Street, City Center
              <br />
              Cafe address placeholder
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

      {showBackToTop && !mobileNavOpen ? (
        <button
          type="button"
          aria-label="Back to top"
          onClick={scrollToTop}
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
      ) : null}
    </main>
  );
}