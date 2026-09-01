"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useTransition,
} from "react";
import { useAos } from "@/components/AosInitializer";
import { useWaiterCart } from "@/hooks/waiter/useWaiterCart";
import { useWaiterData } from "@/hooks/waiter/useWaiterData";
import type { Category, Product } from "@/lib/types";
import {
  buildModifierLines,
  getProductModifierGroups,
  type CustomerOrderResponse,
  type SelectedModifiersMap,
} from "./customer-order-utils";
import CustomerOrderHeader from "./UI/CustomerOrderHeader";
import MenuBrowserPanel from "./UI/MenuBrowserPanel";
import ProductGridPanel from "./UI/ProductGridPanel";
import BackToTopButton from "./UI/BackToTopButton";
import { CustomerOrderState } from "@/types/customer-order.types";
import CustomerOrderOverlays from "./UI/CustomerOrderOverlays";
import { bodyFont } from "./customer-order-styles";

function isPastScrollOffset(offset: number) {
  return typeof window !== "undefined" && window.scrollY > offset;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function useBackToTopVisibility(offset: number) {
  const [showBackToTop, setShowBackToTop] = useState(() =>
    isPastScrollOffset(offset),
  );

  useEffect(() => {
    function handleScroll() {
      setShowBackToTop(isPastScrollOffset(offset));
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [offset]);

  return showBackToTop;
}

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

type CustomerOrderAction =
  | { type: "reset" }
  | { type: "searchChanged"; searchTerm: string }
  | { type: "categorySelected"; category: string }
  | { type: "customerNameChanged"; customerName: string }
  | { type: "customerPhoneChanged"; customerPhone: string }
  | { type: "orderNoteChanged"; orderNote: string }
  | { type: "cartOpened" }
  | { type: "cartClosed" }
  | { type: "cartCleared" }
  | { type: "cartItemAdded" }
  | { type: "baristaUnavailable" }
  | { type: "modifierOpened"; product: Product }
  | { type: "modifierClosed" }
  | { type: "modifierConfirmed" }
  | { type: "checkoutBlocked"; error: string }
  | { type: "checkoutStarted" }
  | { type: "checkoutSucceeded"; orderNumber: number; message: string }
  | { type: "checkoutFailed"; error: string }
  | { type: "checkoutFinished" };

const initialCustomerOrderState: CustomerOrderState = {
  selectedCategoryValue: "all",
  searchTerm: "",
  customerName: "",
  customerPhone: "",
  orderNote: "",
  selectedProduct: null,
  modifierModalOpen: false,
  cartOpen: false,
  isSubmitting: false,
  submitMessage: "",
  submitError: "",
  lastOrderNumber: null,
};

function customerOrderReducer(
  state: CustomerOrderState,
  action: CustomerOrderAction,
): CustomerOrderState {
  switch (action.type) {
    case "reset":
      return initialCustomerOrderState;
    case "searchChanged":
      return { ...state, searchTerm: action.searchTerm };
    case "categorySelected":
      return { ...state, selectedCategoryValue: action.category };
    case "customerNameChanged":
      return { ...state, customerName: action.customerName };
    case "customerPhoneChanged":
      return { ...state, customerPhone: action.customerPhone };
    case "orderNoteChanged":
      return { ...state, orderNote: action.orderNote };
    case "cartOpened":
      return { ...state, cartOpen: true };
    case "cartClosed":
      return { ...state, cartOpen: false };
    case "cartCleared":
      return { ...state, orderNote: "", submitError: "", submitMessage: "" };
    case "cartItemAdded":
      return { ...state, cartOpen: true, submitError: "", submitMessage: "" };
    case "baristaUnavailable":
      return {
        ...state,
        submitError: "Barista items are unavailable right now.",
        submitMessage: "",
      };
    case "modifierOpened":
      return {
        ...state,
        selectedProduct: action.product,
        modifierModalOpen: true,
      };
    case "modifierClosed":
      return { ...state, selectedProduct: null, modifierModalOpen: false };
    case "modifierConfirmed":
      return {
        ...state,
        selectedProduct: null,
        modifierModalOpen: false,
        cartOpen: true,
        submitError: "",
        submitMessage: "",
      };
    case "checkoutBlocked":
      return {
        ...state,
        submitError: action.error,
        submitMessage: "",
        cartOpen: true,
      };
    case "checkoutStarted":
      return {
        ...state,
        isSubmitting: true,
        submitError: "",
        submitMessage: "Sending your order...",
      };
    case "checkoutSucceeded":
      return {
        ...state,
        lastOrderNumber: action.orderNumber,
        submitMessage: action.message,
        orderNote: "",
        cartOpen: true,
      };
    case "checkoutFailed":
      return {
        ...state,
        submitError: action.error,
        submitMessage: "",
        cartOpen: true,
      };
    case "checkoutFinished":
      return { ...state, isSubmitting: false };
    default:
      return state;
  }
}

export default function CustomerOrderPage() {
  const { productsAll, categories, baristas, loading } = useWaiterData();
  const {
    cart,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    calculateCartTotal,
  } = useWaiterCart();

  const [orderState, dispatchOrderState] = useReducer(
    customerOrderReducer,
    initialCustomerOrderState,
  );
  const deferredSearch = useDeferredValue(orderState.searchTerm);
  const [isFiltering, startFiltering] = useTransition();
  const showBackToTop = useBackToTopVisibility(520);

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
        count: kioskProducts.filter(
          (product) => product.category?.id === category.id,
        ).length,
      })),
    ],
    [kioskCategories, kioskProducts],
  );
  const selectedCategory =
    orderState.selectedCategoryValue === "all" ||
    categoryChips.some(
      (category) => category.id === orderState.selectedCategoryValue,
    )
      ? orderState.selectedCategoryValue
      : "all";

  const filteredProducts = useMemo(() => {
    const term = deferredSearch.toLowerCase().trim();

    return kioskProducts.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" || product.category?.id === selectedCategory;
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.description ?? "").toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [deferredSearch, kioskProducts, selectedCategory]);

  const selectedCategoryName =
    categoryChips.find((category) => category.id === selectedCategory)?.name ??
    "All";

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const cartSubtotal = calculateCartTotal();

  useAos(
    cart.length,
    orderState.cartOpen,
    filteredProducts.length,
    isFiltering,
    orderState.modifierModalOpen,
    selectedCategory,
  );

  function resetKiosk() {
    clearCart();
    dispatchOrderState({ type: "reset" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeModifierModal() {
    dispatchOrderState({ type: "modifierClosed" });
  }

  function handleProductClick(product: Product) {
    if (product.category?.station === "BARISTA" && baristas.length === 0) {
      dispatchOrderState({ type: "baristaUnavailable" });
      return;
    }

    if (getProductModifierGroups(product).length > 0) {
      dispatchOrderState({ type: "modifierOpened", product });
      return;
    }

    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: [],
      finalPrice: Number(product.price) || 0,
    });
    dispatchOrderState({ type: "cartItemAdded" });
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
        ? (baristas.find((barista) => barista.id === assignedBaristaId) ?? null)
        : null;

    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: modifierLines,
      finalPrice: (Number(product.price) || 0) + modifiersTotal,
      assignedUserId: assignedBarista?.id ?? null,
      assignedUserName: assignedBarista?.fullName ?? null,
    });
    dispatchOrderState({ type: "modifierConfirmed" });
  }

  async function handlePlaceOrder() {
    if (!orderState.customerName.trim()) {
      dispatchOrderState({
        type: "checkoutBlocked",
        error: "Enter your name before checkout.",
      });
      return;
    }

    if (cart.length === 0) {
      dispatchOrderState({
        type: "checkoutBlocked",
        error: "Add at least one item to your cart.",
      });
      return;
    }

    try {
      dispatchOrderState({ type: "checkoutStarted" });

      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: orderState.customerName,
          customerPhone: orderState.customerPhone,
          notes: orderState.orderNote,
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

      dispatchOrderState({
        type: "checkoutSucceeded",
        orderNumber: data.order.orderNumber,
        message: `Order #${data.order.orderNumber} is confirmed and queued for the kitchen.`,
      });
      clearCart();
    } catch (error) {
      dispatchOrderState({
        type: "checkoutFailed",
        error: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      dispatchOrderState({ type: "checkoutFinished" });
    }
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(120deg,rgba(31,41,55,0.10)_0_1px,transparent_1px_100%),linear-gradient(180deg,#f4eadb_0%,#fffaf3_34%,#e7d1b1_100%)] bg-size[28px_28px,auto] text-foreground dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_100%),linear-gradient(180deg,#1d120d_0%,#2a1c15_45%,#17100c_100%)]"
      style={{ fontFamily: bodyFont }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))]" />

      <div className="relative mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <CustomerOrderHeader
          historyHref="/customer/orders"
          cartSubtotal={cartSubtotal}
          cartCount={cartCount}
          onReset={resetKiosk}
          onOpenCart={() => dispatchOrderState({ type: "cartOpened" })}
        />

        <MenuBrowserPanel
          searchTerm={orderState.searchTerm}
          categoryChips={categoryChips}
          selectedCategory={selectedCategory}
          onSearchChange={(searchTerm) =>
            dispatchOrderState({ type: "searchChanged", searchTerm })
          }
          onCategorySelect={(category) =>
            startFiltering(() => {
              dispatchOrderState({ type: "categorySelected", category });
            })
          }
        />

        <ProductGridPanel
          loading={loading}
          filteredProducts={filteredProducts}
          baristas={baristas}
          selectedCategoryName={selectedCategoryName}
          isFiltering={isFiltering}
          onProductClick={handleProductClick}
        />
      </div>

      <BackToTopButton
        show={
          showBackToTop && !orderState.cartOpen && !orderState.modifierModalOpen
        }
        onClick={scrollToTop}
      />

      <CustomerOrderOverlays
        orderState={orderState}
        baristas={baristas}
        cart={cart}
        cartSubtotal={cartSubtotal}
        cartCount={cartCount}
        onCloseModifier={closeModifierModal}
        onConfirmModifier={handleModifierConfirm}
        onCloseCart={() => dispatchOrderState({ type: "cartClosed" })}
        onCustomerNameChange={(customerName) =>
          dispatchOrderState({ type: "customerNameChanged", customerName })
        }
        onCustomerPhoneChange={(customerPhone) =>
          dispatchOrderState({ type: "customerPhoneChanged", customerPhone })
        }
        onOrderNoteChange={(orderNote) =>
          dispatchOrderState({ type: "orderNoteChanged", orderNote })
        }
        onChangeQuantity={changeQuantity}
        onRemove={removeFromCart}
        onClearCart={() => {
          clearCart();
          dispatchOrderState({ type: "cartCleared" });
        }}
        onCheckout={handlePlaceOrder}
      />
    </main>
  );
}
