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
import type { Product } from "@/lib/types";
import {
  getCustomerCategories,
  getCustomerModifierGroups,
  getCustomerProducts,
} from "./customer-fallbacks";
import CustomerCartSheet from "./CustomerCartSheet";
import CustomerModifierModal from "./CustomerModifierModal";
import CustomerProductGrid from "./CustomerProductGrid";
import {
  buildModifierLines,
  formatCurrency,
  type CustomerOrderResponse,
  type SelectedModifiersMap,
} from "./customer-order-utils";

const displayFont =
  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif';
const bodyFont = '"Avenir Next", "Segoe UI", sans-serif';

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

  const kioskCategories = useMemo(
    () => getCustomerCategories(categories, productsAll),
    [categories, productsAll],
  );
  const kioskProducts = useMemo(
    () => getCustomerProducts(productsAll, kioskCategories),
    [kioskCategories, productsAll],
  );
  const usingSampleMenu = productsAll.length === 0 && kioskProducts.length > 0;

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
    usingSampleMenu,
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

    if (getCustomerModifierGroups(product).length > 0) {
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
    if (usingSampleMenu) {
      setSubmitError(
        "Sample menu preview is active. Add real products to enable checkout.",
      );
      setSubmitMessage("");
      return;
    }

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
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.20),transparent_22%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_22%),linear-gradient(180deg,#f6eee4_0%,#fbf7f1_38%,#f1e6d8_100%)] text-stone-900"
      style={{ fontFamily: bodyFont }}
    >
      <div
        data-aos="fade"
        className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl"
      />
      <div
        data-aos="fade"
        data-aos-delay="120"
        className="pointer-events-none absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-orange-300/18 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header
          data-aos="fade-down"
          className="sticky top-4 z-30 rounded-[2rem] border border-white/70 bg-white/75 px-5 py-4 shadow-[0_26px_90px_rgba(67,39,20,0.13)] backdrop-blur-xl"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="h-14 w-14 rounded-[1.25rem] border border-stone-200 bg-cover bg-center shadow-sm"
                style={{ backgroundImage: 'url("/logo.png")' }}
              />
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
                  Customer Ordering
                </p>
                <h1
                  className="mt-1 text-2xl text-stone-950 sm:text-3xl"
                  style={{ fontFamily: displayFont }}
                >
                  Mash Allah Cafe
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetKiosk}
                className="rounded-full border border-stone-200 bg-stone-50 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
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
          data-aos="fade-up"
          className="mt-5 rounded-[2.25rem] border border-white/70 bg-white/78 p-5 shadow-[0_30px_90px_rgba(67,39,20,0.12)] backdrop-blur-xl"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
                Browse by category
              </p>
              <h2
                className="mt-2 text-3xl text-stone-950 sm:text-4xl"
                style={{ fontFamily: displayFont }}
              >
                Pick a section, then tap a card to order
              </h2>
            </div>

            <div className="w-full max-w-md">
              <label className="sr-only" htmlFor="menu-search">
                Search menu
              </label>
              <input
                id="menu-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search coffee, burgers, desserts..."
                className="w-full rounded-full border border-stone-200 bg-stone-50 px-5 py-3.5 text-sm outline-none focus:border-stone-400"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
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
                  className={`min-w-[8rem] rounded-full px-5 py-3 text-left text-sm font-semibold transition ${
                    active
                      ? "bg-stone-950 text-white shadow-[0_14px_28px_rgba(28,16,10,0.22)]"
                      : "border border-stone-200 bg-stone-50 text-stone-700 hover:bg-white"
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

        {usingSampleMenu ? (
          <div
            data-aos="fade-up"
            className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
          >
            Real products were not found, so this screen is showing a curated
            placeholder cafe menu. Checkout stays disabled until real POS products
            are available.
          </div>
        ) : null}

        <section
          data-aos="fade-up"
          data-aos-delay="100"
          className="mt-5 rounded-[2.25rem] border border-white/70 bg-white/72 p-5 shadow-[0_30px_90px_rgba(67,39,20,0.12)] backdrop-blur-xl"
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Product grid
              </p>
              <h2
                className="mt-2 text-3xl text-stone-950"
                style={{ fontFamily: displayFont }}
              >
                {selectedCategoryName}
              </h2>
            </div>
            <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700">
              {filteredProducts.length} item
              {filteredProducts.length === 1 ? "" : "s"}
            </div>
          </div>

          <CustomerProductGrid
            loading={loading}
            products={filteredProducts}
            baristas={baristas}
            selectedCategoryName={selectedCategoryName}
            isFiltering={isFiltering}
            onProductClick={handleProductClick}
          />
        </section>
      </div>

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
        usingSampleMenu={usingSampleMenu}
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

