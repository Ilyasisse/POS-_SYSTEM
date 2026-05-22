"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useAos } from "@/app/components/AosInitializer";
import { getKitchenSocketUrl } from "@/lib/kitchen-socket";
import { useWaiterCart } from "@/hooks/useWaiterCart";
import { useWaiterData } from "@/hooks/useWaiterData";
import { useWaiterSocket } from "@/hooks/useWaiterSocket";
import type { Category, Product } from "@/lib/types";
import CustomerCartSheet from "./CustomerCartSheet";
import CustomerModifierModal from "./CustomerModifierModal";
import CustomerProductGrid from "./CustomerProductGrid";
import {
  buildModifierLines,
  formatCurrency,
  getProductModifierGroups,
  type CustomerOrderResponse,
  type SelectedModifiersMap,
} from "./customer-order-utils";

const displayFont =
  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif';
const bodyFont = '"Avenir Next", "Segoe UI", sans-serif';

function getMenuCategories(categories: Category[], products: Product[]) {
  if (categories.length > 0) {
    return categories;
  }

  return Array.from(
    new Map(
      products
        .map((product) => product.category)
        .filter((category): category is NonNullable<Product["category"]> =>
          Boolean(category?.id && category?.name),
        )
        .map((category, index) => [
          category.id,
          {
            id: category.id,
            name: category.name,
            sortOrder: index,
            isActive: true,
            iconUrl: null,
            station: category.station ?? null,
          } satisfies Category,
        ]),
    ).values(),
  );
}

export default function CustomerOrderPage() {
  const socketUrl = useMemo(() => getKitchenSocketUrl(), []);
  const { socketStatus, statusMessage, sendKitchenTicket } =
    useWaiterSocket(socketUrl);
  const { productsAll, categories, baristas, loading } = useWaiterData();
  const {
    cart,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    calculateCartTotal,
  } = useWaiterCart();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const [isFiltering, startFiltering] = useTransition();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modifierModalOpen, setModifierModalOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const kioskCategories = useMemo(
    () => getMenuCategories(categories, productsAll),
    [categories, productsAll],
  );
  const kioskProducts = useMemo(
    () =>
      productsAll.map((product) => ({
        ...product,
        price: Number(product.price) || 0,
      })),
    [productsAll],
  );

  const categoryChips = useMemo(
    () => [
      {
        id: "all",
        name: "All",
        count: kioskProducts.length,
      },
      ...kioskCategories.map((category) => ({
        id: category.id,
        name: category.name,
        count: kioskProducts.filter((product) => product.category?.id === category.id)
          .length,
      })),
    ],
    [kioskCategories, kioskProducts],
  );

  const filteredProducts = useMemo(() => {
    const term = deferredSearch.toLowerCase().trim();

    return kioskProducts.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" || product.category?.id === selectedCategory;
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.description ?? "").toLowerCase().includes(term) ||
        (product.sku ?? "").toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [deferredSearch, kioskProducts, selectedCategory]);

  const selectedCategoryName =
    categoryChips.find((category) => category.id === selectedCategory)?.name ?? "All";

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const cartSubtotal = calculateCartTotal();

  useAos([
    cart.length,
    cartOpen,
    filteredProducts.length,
    isFiltering,
    modifierModalOpen,
    selectedCategory,
  ]);

  useEffect(() => {
    if (selectedCategory === "all") {
      return;
    }

    const categoryStillExists = categoryChips.some(
      (category) => category.id === selectedCategory,
    );

    if (!categoryStillExists) {
      setSelectedCategory("all");
    }
  }, [categoryChips, selectedCategory]);

  useEffect(() => {
    function handleScroll() {
      setShowBackToTop(window.scrollY > 520);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function resetKiosk() {
    clearCart();
    setSearchTerm("");
    setCustomerName("");
    setCustomerPhone("");
    setOrderNote("");
    setSelectedCategory("all");
    setSelectedProduct(null);
    setModifierModalOpen(false);
    setCartOpen(false);
    setSubmitError("");
    setSubmitMessage("");
    setLastOrderNumber(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeModifierModal() {
    setSelectedProduct(null);
    setModifierModalOpen(false);
  }

  function handleProductClick(product: Product) {
    if (product.category?.station === "BARISTA" && baristas.length === 0) {
      setSubmitError("Barista items are unavailable right now.");
      setSubmitMessage("");
      return;
    }

    if (getProductModifierGroups(product).length > 0) {
      setSelectedProduct(product);
      setModifierModalOpen(true);
      return;
    }

    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: [],
      finalPrice: Number(product.price) || 0,
    });
    setCartOpen(true);
    setSubmitError("");
    setSubmitMessage("");
  }

  function handleModifierConfirm(
    product: Product,
    selectedModifiers: SelectedModifiersMap,
    assignedBaristaId: string | null,
  ) {
    const modifierLines = buildModifierLines(product, selectedModifiers);
    const modifiersTotal = modifierLines.reduce(
      (sum, modifier) => sum + modifier.price * modifier.qty,
      0,
    );
    const assignedBarista =
      assignedBaristaId != null
        ? baristas.find((barista) => barista.id === assignedBaristaId) ?? null
        : null;

    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: modifierLines,
      finalPrice: (Number(product.price) || 0) + modifiersTotal,
      assignedUserId: assignedBarista?.id ?? null,
      assignedUserName: assignedBarista?.fullName ?? null,
    });
    setCartOpen(true);
    setSubmitError("");
    setSubmitMessage("");
    closeModifierModal();
  }

  async function handlePlaceOrder() {
    if (!customerName.trim()) {
      setSubmitError("Enter your name before checkout.");
      setSubmitMessage("");
      setCartOpen(true);
      return;
    }

    if (cart.length === 0) {
      setSubmitError("Add at least one item to your cart.");
      setSubmitMessage("");
      setCartOpen(true);
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setSubmitMessage("Sending your order...");

      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName,
          customerPhone,
          notes: orderNote,
          items: cart.map((item) => ({
            productId: item.id,
            qty: item.quantity,
            assignedBaristaId: item.assignedUserId ?? null,
            modifiers: item.selectedModifiers.map((modifier) => ({
              modifierId: modifier.optionId,
              qty: modifier.qty,
              modifierName: modifier.optionName,
              groupName: modifier.groupName,
              price: modifier.price,
              isPlaceholder: modifier.optionId.startsWith("placeholder__"),
            })),
          })),
        }),
      });

      const data = (await response.json()) as CustomerOrderResponse;

      if (!response.ok || !data.success || !data.order) {
        throw new Error(data.error || "The order could not be placed.");
      }

      if (data.kitchenTicket) {
        sendKitchenTicket(data.kitchenTicket);
      }

      setLastOrderNumber(data.order.orderNumber);
      setSubmitMessage(
        `Order #${data.order.orderNumber} is confirmed and queued for the kitchen.`,
      );
      setOrderNote("");
      clearCart();
      setCartOpen(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
      setSubmitMessage("");
      setCartOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(120deg,rgba(31,41,55,0.10)_0_1px,transparent_1px_100%),linear-gradient(180deg,#f4eadb_0%,#fffaf3_34%,#e7d1b1_100%)] bg-[size:28px_28px,auto] text-stone-900"
      style={{ fontFamily: bodyFont }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))]" />

      <div className="relative mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <header
          data-aos="fade-down"
          className="sticky top-2 z-30 rounded-[1.25rem] border border-white/80 bg-white/88 px-4 py-4 shadow-[0_20px_60px_rgba(44,28,17,0.14)] backdrop-blur-xl sm:top-4 sm:rounded-[1.5rem] sm:px-5 sm:py-5"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-amber-200/70 bg-white p-1.5 shadow-sm sm:h-14 sm:w-14 sm:rounded-[1.25rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/newer_logo.png"
                  alt="Mash Allah Cafe"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h1
                  className="mt-1 text-xl text-stone-950 sm:text-3xl"
                  style={{ fontFamily: displayFont }}
                >
                  Mash Allah Cafe
                </h1>
               
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap">
              <button
                type="button"
                onClick={resetKiosk}
                className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                Start Over
              </button>

              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Cart {formatCurrency(cartSubtotal)} ({cartCount})
              </button>
            </div>
          </div>
        </header>

        <section
          data-aos="zoom-in"
          data-aos-delay="100"
          className="mt-4 rounded-[1.25rem] border border-white/80 bg-white/88 p-4 shadow-[0_22px_65px_rgba(44,28,17,0.12)] backdrop-blur-xl sm:mt-5 sm:rounded-[1.75rem] sm:p-5"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
                Browse by category
              </p>
              <h2
                className="mt-2 text-2xl text-stone-950 sm:text-4xl"
                style={{ fontFamily: displayFont }}
              >
                Pick a section, then tap a card to order
              </h2>
            </div>

            <div className="w-full lg:max-w-md">
              <label className="sr-only" htmlFor="menu-search">
                Search menu
              </label>
              <input
                id="menu-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search coffee, burgers, desserts..."
                className="w-full rounded-full border border-stone-200 bg-white px-5 py-3.5 text-sm shadow-inner outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory sm:gap-3">
            {categoryChips.map((category) => {
              const active = selectedCategory === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    startFiltering(() => {
                      setSelectedCategory(category.id);
                    })
                  }
                    className={`min-w-[7rem] snap-start rounded-full px-4 py-3 text-left text-sm font-semibold transition sm:min-w-[8rem] sm:px-5 ${
                      active
                        ? "bg-stone-950 text-white shadow-[0_14px_28px_rgba(28,16,10,0.22)]"
                        : "border border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  <div>{category.name}</div>
                  <div
                    className={`mt-1 text-[11px] uppercase tracking-[0.18em] ${
                      active ? "text-stone-200" : "text-stone-500"
                    }`}
                  >
                    {category.count} items
                  </div>
                </button>
              );
            })}
          </div>
        </section>

       

        <section
          data-aos="fade-up"
          data-aos-delay="100"
          className="mt-4 rounded-[1.25rem] border border-white/80 bg-white/84 p-4 shadow-[0_22px_65px_rgba(44,28,17,0.12)] backdrop-blur-xl sm:mt-5 sm:rounded-[1.75rem] sm:p-5"
        >
          <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Product grid
              </p>
              <h2
                className="mt-2 text-2xl text-stone-950 sm:text-3xl"
                style={{ fontFamily: displayFont }}
              >
                {selectedCategoryName}
              </h2>
            </div>
            <div className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm">
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
              onProductClick={handleProductClick}
            />
          </div>
        </section>
      </div>

      {showBackToTop && !cartOpen && !modifierModalOpen ? (
        <button
          type="button"
          aria-label="Back to top"
          onClick={scrollToTop}
          className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-stone-950 text-white shadow-[0_18px_45px_rgba(44,28,17,0.28)] transition hover:-translate-y-0.5 hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 sm:bottom-7 sm:right-7 sm:h-14 sm:w-14"
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

      <CustomerModifierModal
        open={modifierModalOpen}
        product={selectedProduct}
        baristas={baristas}
        onClose={closeModifierModal}
        onConfirm={handleModifierConfirm}
      />

      <CustomerCartSheet
        open={cartOpen}
        cart={cart}
        customerName={customerName}
        customerPhone={customerPhone}
        orderNote={orderNote}
        cartSubtotal={cartSubtotal}
        cartCount={cartCount}
        isSubmitting={isSubmitting}
        submitMessage={submitMessage}
        submitError={submitError}
        statusMessage={statusMessage}
        socketStatus={socketStatus}
        lastOrderNumber={lastOrderNumber}
        onClose={() => setCartOpen(false)}
        onCustomerNameChange={setCustomerName}
        onCustomerPhoneChange={setCustomerPhone}
        onOrderNoteChange={setOrderNote}
        onChangeQuantity={changeQuantity}
        onRemove={removeFromCart}
        onClearCart={() => {
          clearCart();
          setOrderNote("");
          setSubmitError("");
          setSubmitMessage("");
        }}
        onCheckout={handlePlaceOrder}
      />
    </main>
  );
}

