"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import posthog from "posthog-js";
import { useAos } from "@/components/AosInitializer";
import { useWaiterCart } from "@/hooks/waiter/useWaiterCart";
import { useCustomerOrderData } from "@/hooks/customer/useCustomerOrderData";
import {
  clearCustomerOrderDraft,
  restoreCustomerOrderDraft,
  saveCustomerOrderDraft,
} from "@/lib/customer/customer-order-draft";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Category, Product } from "@/lib/types";
import {
  buildModifierLines,
  getProductModifierGroups,
  type SelectedModifiersMap,
} from "./customer-order-utils";
import CustomerOrderHeader from "./UI/CustomerOrderHeader";
import MenuBrowserPanel from "./UI/MenuBrowserPanel";
import ProductGridPanel from "./UI/ProductGridPanel";
import BackToTopButton from "./UI/BackToTopButton";
import { CustomerOrderState } from "@/types/customer-order.types";
import CustomerOrderOverlays from "./UI/CustomerOrderOverlays";
import { bodyFont } from "./customer-order-styles";
import { normalizeSomaliPhone } from "@/lib/payments/customer-ussd";

const posthogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
  process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

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
  | { type: "checkoutFinished" }
  | {
      type: "draftRestored";
      customerName: string;
      customerPhone: string;
      orderNote: string;
      message: string;
      error: string;
    };

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
    case "draftRestored":
      return {
        ...state,
        customerName: action.customerName,
        customerPhone: action.customerPhone,
        orderNote: action.orderNote,
        submitMessage: action.message,
        submitError: action.error,
        cartOpen: true,
      };
    default:
      return state;
  }
}

type CustomerOrderPageProps = {
  authState: "guest" | "customer" | "blocked";
};

export default function CustomerOrderPage({
  authState,
}: CustomerOrderPageProps) {
  const {
    productsAll,
    categories,
    baristas,
    loading,
    error: catalogError,
  } = useCustomerOrderData();
  const {
    cart,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    replaceCart,
    calculateCartTotal,
  } = useWaiterCart();

  const [orderState, dispatchOrderState] = useReducer(
    customerOrderReducer,
    initialCustomerOrderState,
  );
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const restoredRef = useRef(false);
  const checkoutKeyRef = useRef<string | null>(null);
  useEffect(() => {
    checkoutKeyRef.current = null;
  }, [cart, orderState.customerName, orderState.customerPhone, orderState.orderNote]);
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

  useEffect(() => {
    if (loading || catalogError || restoredRef.current) return;
    restoredRef.current = true;
    const restored = restoreCustomerOrderDraft(productsAll, baristas);
    if (restored) {
      replaceCart(restored.cart);
      const issues = [
        restored.skipped > 0
          ? `${restored.skipped} unavailable item(s) were removed. Add them again if needed.`
          : "",
        restored.repriced > 0
          ? `${restored.repriced} item(s) have updated prices. Review the total before checkout.`
          : "",
      ].filter(Boolean);
      dispatchOrderState({
        type: "draftRestored",
        customerName: restored.customerName,
        customerPhone: restored.customerPhone,
        orderNote: restored.orderNote,
        message: issues.length
          ? ""
          : "Your order is ready to review. Press Checkout when you are ready.",
        error: issues.join(" "),
      });
    }
    setDraftReady(true);
  }, [loading, catalogError, productsAll, baristas, replaceCart]);

  useEffect(() => {
    if (!draftReady) return;
    if (cart.length === 0) {
      clearCustomerOrderDraft();
      return;
    }
    saveCustomerOrderDraft(
      cart,
      orderState.customerName,
      orderState.customerPhone,
      orderState.orderNote,
    );
  }, [
    draftReady,
    cart,
    orderState.customerName,
    orderState.customerPhone,
    orderState.orderNote,
  ]);

  useAos(
    cart.length,
    orderState.cartOpen,
    filteredProducts.length,
    isFiltering,
    orderState.modifierModalOpen,
    selectedCategory,
  );

  function resetKiosk() {
    clearCustomerOrderDraft();
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

    if (
      getProductModifierGroups(product).length > 0 ||
      product.category?.station === "BARISTA"
    ) {
      dispatchOrderState({ type: "modifierOpened", product });
      return;
    }

    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: [],
      finalPrice: Number(product.price) || 0,
    });
    if (posthogConfigured) {
      posthog.capture("cart_item_added", {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
      });
    }
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
    if (posthogConfigured) {
      posthog.capture("cart_item_added", {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
      });
    }
    dispatchOrderState({ type: "modifierConfirmed" });
  }

  async function handlePlaceOrder() {
    if (cart.length === 0) {
      dispatchOrderState({
        type: "checkoutBlocked",
        error: "Add at least one item to your cart.",
      });
      return;
    }
    if (authState === "guest") {
      setSignInError("");
      setSignInOpen(true);
      return;
    }
    if (authState === "blocked") {
      dispatchOrderState({
        type: "checkoutBlocked",
        error: "This account cannot place customer orders.",
      });
      return;
    }
    if (!normalizeSomaliPhone(orderState.customerPhone)) {
      dispatchOrderState({
        type: "checkoutBlocked",
        error: "Enter the mobile money phone number sending this payment.",
      });
      return;
    }
    if (!orderState.customerName.trim()) {
      dispatchOrderState({
        type: "checkoutBlocked",
        error: "Enter your name before checkout.",
      });
      return;
    }

    try {
      dispatchOrderState({ type: "checkoutStarted" });

      const response = await fetch("/api/customer/checkouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: orderState.customerName,
          paymentPhone: orderState.customerPhone,
          idempotencyKey: checkoutKeyRef.current ??= crypto.randomUUID(),
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

      if (response.status === 401) {
        setSignInError("");
        setSignInOpen(true);
        return;
      }
      const data = (await response.json()) as {
        checkout?: { id: string };
        error?: string;
      };
      if (!response.ok || !data.checkout?.id) {
        throw new Error(data.error || "Could not start mobile money checkout.");
      }
      window.location.assign(`/customer/checkout/${encodeURIComponent(data.checkout.id)}`);
    } catch (error) {
      dispatchOrderState({
        type: "checkoutFailed",
        error: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      dispatchOrderState({ type: "checkoutFinished" });
    }
  }

  function handleContinueWithGoogle() {
    const saved = saveCustomerOrderDraft(
      cart,
      orderState.customerName,
      orderState.customerPhone,
      orderState.orderNote,
    );
    if (!saved) {
      setSignInError(
        "Your browser could not save this order. Please allow session storage and try again.",
      );
      return;
    }
    window.location.assign("/auth/google/start?next=%2Fcustomer");
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(120deg,rgba(31,41,55,0.10)_0_1px,transparent_1px_100%),linear-gradient(180deg,#f4eadb_0%,#fffaf3_34%,#e7d1b1_100%)] bg-size[28px_28px,auto] text-foreground dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_100%),linear-gradient(180deg,#1d120d_0%,#2a1c15_45%,#17100c_100%)]"
      style={{ fontFamily: bodyFont }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))]" />

      <div className="relative mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <CustomerOrderHeader
          cartSubtotal={cartSubtotal}
          cartCount={cartCount}
          onReset={resetKiosk}
          onOpenCart={() => dispatchOrderState({ type: "cartOpened" })}
        />
        {catalogError ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"
          >
            {catalogError}
          </div>
        ) : null}

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
          clearCustomerOrderDraft();
          clearCart();
          dispatchOrderState({ type: "cartCleared" });
        }}
        onCheckout={handlePlaceOrder}
      />
      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Sign in to place your order</DialogTitle>
            <DialogDescription>
              Continue with Google. We will bring you back to this cart so you
              can review it before placing your order.
            </DialogDescription>
          </DialogHeader>
          {signInError ? (
            <p role="alert" className="text-sm text-rose-700">
              {signInError}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={handleContinueWithGoogle}
            className="w-full rounded-full"
          >
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSignInOpen(false)}
            className="w-full rounded-full"
          >
            Keep editing
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
