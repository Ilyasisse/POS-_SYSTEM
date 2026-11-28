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
import { useRouter } from "next/navigation";
import Link from "next/link";
import { afterCashierItemAdded } from "@/lib/cashier/cashier-presentation";
import { useToast } from "@/components/ui/toast";
import CashierMenu from "./CashierMenu";
import { useAos } from "@/components/AosInitializer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWaiterCart } from "@/hooks/waiter/useWaiterCart";
import { useWaiterData } from "@/hooks/waiter/useWaiterData";
import type { Category, Product } from "@/lib/types";
import CustomerModifierModal from "@/components/customer/CustomerModifierModal";
import CustomerCartSheet, { CustomerCartPanel } from "@/components/customer/CustomerCartSheet";
import {
  buildModifierLines,
  getProductModifierGroups,
  type SelectedModifiersMap,
} from "@/components/customer/customer-order-utils";

type TableOption = { id: string; name: string };
type Props = {
  tables: TableOption[];
  initialTableId?: string;
  orderType?: "DINE_IN" | "TAKEOUT";
};
type State = {
  tableId: string;
  categoryId: string;
  searchTerm: string;
  orderNote: string;
  paymentMethod: string;
  selectedProduct: Product | null;
  modifierOpen: boolean;
  cartOpen: boolean;
  submitting: boolean;
  message: string;
  error: string;
};
type Action =
  | { type: "table"; value: string }
  | { type: "category"; value: string }
  | { type: "search"; value: string }
  | { type: "note"; value: string }
  | { type: "paymentMethod"; value: string }
  | { type: "modifierOpen"; product: Product }
  | { type: "modifierClose" }
  | { type: "cartOpen" }
  | { type: "cartClose" }
  | { type: "cleared" }
  | { type: "added" }
  | { type: "submitting" }
  | { type: "failed"; error: string }
  | { type: "finished" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "table":
      return { ...state, tableId: action.value, error: "" };
    case "category":
      return { ...state, categoryId: action.value };
    case "search":
      return { ...state, searchTerm: action.value };
    case "note":
      return { ...state, orderNote: action.value };
    case "paymentMethod":
      return { ...state, paymentMethod: action.value, error: "" };
    case "modifierOpen":
      return { ...state, selectedProduct: action.product, modifierOpen: true };
    case "modifierClose":
      return { ...state, selectedProduct: null, modifierOpen: false };
    case "cartOpen":
      return { ...state, cartOpen: true };
    case "cartClose":
      return { ...state, cartOpen: false };
    case "cleared":
      return { ...state, orderNote: "", message: "", error: "" };
    case "added":
      return afterCashierItemAdded(state);
    case "submitting":
      return {
        ...state,
        submitting: true,
        message: "Sending the order to the kitchen...",
        error: "",
      };
    case "failed":
      return { ...state, error: action.error, message: "", cartOpen: true };
    case "finished":
      return { ...state, submitting: false };
  }
}

function getCategories(categories: Category[], products: Product[]) {
  if (categories.length) return categories;
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

function useDesktopCartPanel() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateMatch = () => setIsDesktop(mediaQuery.matches);

    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);
    return () => mediaQuery.removeEventListener("change", updateMatch);
  }, []);

  return isDesktop;
}

function TablePicker({
  open,
  tables,
  onSelect,
}: {
  open: boolean;
  tables: TableOption[];
  onSelect: (id: string) => void;
}) {
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="border-border bg-card max-h-[90dvh] overflow-y-auto rounded-2xl border p-4 sm:max-w-2xl sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-foreground text-center text-3xl sm:text-4xl">
            Select an available table
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Choose the table before adding items. Occupied tables are hidden.
          </DialogDescription>
        </DialogHeader>
        {tables.length ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tables.map((table) => (
              <Button
                key={table.id}
                type="button"
                variant="outline"
                onClick={() => onSelect(table.id)}
                className="border-border bg-card text-foreground hover:border-ring hover:bg-accent dark:bg-card dark:hover:bg-accent min-h-24 rounded-[1.5rem] border text-xl font-semibold shadow-sm"
              >
                {table.name}
              </Button>
            ))}
          </div>
        ) : (
          <div className="border-border text-muted-foreground mt-4 rounded-[1.5rem] border border-dashed p-8 text-center">
            Every active table is currently occupied.
          </div>
        )}
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/cashier">Back to tables</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function CashierOrderExperience({
  tables,
  initialTableId = "",
  orderType = "DINE_IN",
}: Props) {
  const isTakeaway = orderType === "TAKEOUT";
  const router = useRouter();
  const sendingRef = useRef(false);
  const { toast } = useToast();
  const isDesktopCartPanel = useDesktopCartPanel();
  const [state, dispatch] = useReducer(reducer, {
    tableId: tables.some((table) => table.id === initialTableId) ? initialTableId : "",
    categoryId: "all",
    searchTerm: "",
    orderNote: "",
    paymentMethod: "",
    selectedProduct: null,
    modifierOpen: false,
    cartOpen: false,
    submitting: false,
    message: "",
    error: "",
  });
  const { productsAll, categories, baristas, loading } = useWaiterData();
  const { cart, addToCart, changeQuantity, removeFromCart, clearCart, calculateCartTotal } =
    useWaiterCart();
  const deferredSearch = useDeferredValue(state.searchTerm);
  const [isFiltering, startFiltering] = useTransition();
  const products = useMemo(
    () =>
      productsAll.map((product) => ({
        ...product,
        price: Number(product.price) || 0,
      })),
    [productsAll],
  );
  const menuCategories = useMemo(() => getCategories(categories, products), [categories, products]);
  const categoryChips = useMemo(
    () => [
      { id: "all", name: "All", count: products.length },
      ...menuCategories.map((category) => ({
        id: category.id,
        name: category.name,
        count: products.filter((product) => product.category?.id === category.id).length,
      })),
    ],
    [menuCategories, products],
  );
  const selectedCategory = categoryChips.some((category) => category.id === state.categoryId)
    ? state.categoryId
    : "all";
  const filteredProducts = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return products.filter(
      (product) =>
        (selectedCategory === "all" || product.category?.id === selectedCategory) &&
        (!term ||
          product.name.toLowerCase().includes(term) ||
          (product.description ?? "").toLowerCase().includes(term)),
    );
  }, [deferredSearch, products, selectedCategory]);
  const tableName = tables.find((table) => table.id === state.tableId)?.name ?? "";
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const cartSubtotal = calculateCartTotal();
  useAos(state.cartOpen, state.modifierOpen, cart.length);

  function addProduct(product: Product) {
    if (product.category?.station === "BARISTA" && !baristas.length) {
      dispatch({
        type: "failed",
        error: "Barista items are unavailable right now.",
      });
      return;
    }
    if (getProductModifierGroups(product).length) {
      dispatch({ type: "modifierOpen", product });
      return;
    }
    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: [],
      finalPrice: Number(product.price) || 0,
    });
    dispatch({ type: "added" });
    toast({ tone: "success", description: `${product.name} added to the current order.` });
  }

  function confirmModifiers(
    product: Product,
    selected: SelectedModifiersMap,
    baristaId: string | null,
  ) {
    const modifiers = buildModifierLines(product, selected);
    const barista = baristaId ? baristas.find((item) => item.id === baristaId) : null;
    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: modifiers,
      finalPrice:
        (Number(product.price) || 0) +
        modifiers.reduce((sum, modifier) => sum + modifier.price * modifier.qty, 0),
      assignedUserId: barista?.id ?? null,
      assignedUserName: barista?.fullName ?? null,
    });
    dispatch({ type: "modifierClose" });
    dispatch({ type: "added" });
    toast({ tone: "success", description: `${product.name} added to the current order.` });
  }

  async function sendOrder() {
    if (sendingRef.current) return;
    if (!isTakeaway && !state.tableId) {
      dispatch({
        type: "failed",
        error: "Select a table before sending the order.",
      });
      return;
    }
    if (isTakeaway && !state.paymentMethod) {
      dispatch({ type: "failed", error: "Select a payment method." });
      return;
    }
    if (!cart.length) {
      dispatch({
        type: "failed",
        error: "Add at least one item to the order.",
      });
      return;
    }
    sendingRef.current = true;
    try {
      dispatch({ type: "submitting" });
      const response = await fetch(isTakeaway ? "/api/orders" : "/api/orders/table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isTakeaway
            ? { orderType, paymentMethod: state.paymentMethod }
            : { tableId: state.tableId }),
          notes: state.orderNote,
          items: cart.map((item) => ({
            productId: item.id,
            qty: item.quantity,
            assignedBaristaId: item.assignedUserId ?? null,
            modifiers: item.selectedModifiers.map((modifier) => ({
              modifierId: modifier.optionId,
              qty: modifier.qty,
            })),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "The order could not be sent.");
      clearCart();
      router.push(`/cashier?orderStatus=${isTakeaway ? "takeaway_paid" : "sent"}`);
      router.refresh();
    } catch (error) {
      dispatch({
        type: "failed",
        error: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      sendingRef.current = false;
      dispatch({ type: "finished" });
    }
  }

  return (
    <main className="bg-muted/35 text-foreground min-h-dvh pb-28 lg:pb-6">
      <TablePicker
        open={!isTakeaway && !state.tableId}
        tables={tables}
        onSelect={(value) => dispatch({ type: "table", value })}
      />
      <div className="relative mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <header className="bg-card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
          <div className="min-w-0">
            <Link
              href="/cashier"
              className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
            >
              Back to tables
            </Link>
            <h1 className="text-2xl font-bold">{isTakeaway ? "Takeaway order" : "Add items"}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {isTakeaway
                ? "Takeaway · paid at the counter"
                : tableName
                  ? `Ordering for ${tableName}`
                  : "Select a table to begin"}
            </p>
          </div>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={!cart.length || state.submitting}
            onClick={() => {
              if (window.confirm("Clear this unsent order?")) {
                clearCart();
                dispatch({ type: "cleared" });
              }
            }}
          >
            Clear order
          </Button>
        </header>
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="min-w-0">
            <CashierMenu
              search={state.searchTerm}
              onSearch={(value) => dispatch({ type: "search", value })}
              categories={categoryChips}
              category={selectedCategory}
              onCategory={(value) => startFiltering(() => dispatch({ type: "category", value }))}
              products={filteredProducts}
              baristas={baristas}
              loading={loading || isFiltering}
              disabled={state.submitting}
              onAdd={addProduct}
            />
          </div>
          <CustomerCartPanel
            mode="cashier"
            tableName={isTakeaway ? "Takeaway order" : tableName}
            cart={cart}
            customerName=""
            customerPhone=""
            orderNote={state.orderNote}
            cartSubtotal={cartSubtotal}
            cartCount={cartCount}
            isSubmitting={state.submitting}
            submitMessage={state.message}
            submitError={state.error}
            onClose={() => dispatch({ type: "cartClose" })}
            onCustomerNameChange={() => undefined}
            onCustomerPhoneChange={() => undefined}
            onOrderNoteChange={(value) => dispatch({ type: "note", value })}
            paymentMethod={isTakeaway ? state.paymentMethod : undefined}
            checkoutLabel={isTakeaway ? "Pay and send to kitchen" : undefined}
            onPaymentMethodChange={
              isTakeaway ? (value) => dispatch({ type: "paymentMethod", value }) : undefined
            }
            onChangeQuantity={changeQuantity}
            onRemove={removeFromCart}
            onClearCart={() => {
              clearCart();
              dispatch({ type: "cleared" });
            }}
            onCheckout={sendOrder}
          />
        </div>
      </div>
      {!state.cartOpen && (isTakeaway || state.tableId) ? (
        <div className="bg-card fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <p role="status" className="min-w-0 text-sm">
              <strong className="block truncate">{isTakeaway ? "Takeaway" : tableName}</strong>
              {cartCount} items · ${cartSubtotal.toFixed(2)}
            </p>
            <Button
              className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"
              onClick={() => dispatch({ type: "cartOpen" })}
            >
              View order
            </Button>
          </div>
        </div>
      ) : null}
      <CustomerModifierModal
        open={state.modifierOpen}
        product={state.selectedProduct}
        baristas={baristas}
        onClose={() => dispatch({ type: "modifierClose" })}
        onConfirm={confirmModifiers}
      />
      <CustomerCartSheet
        mode="cashier"
        tableName={isTakeaway ? "Takeaway order" : tableName}
        open={state.cartOpen && !isDesktopCartPanel}
        cart={cart}
        customerName=""
        customerPhone=""
        orderNote={state.orderNote}
        cartSubtotal={cartSubtotal}
        cartCount={cartCount}
        isSubmitting={state.submitting}
        submitMessage={state.message}
        submitError={state.error}
        onClose={() => dispatch({ type: "cartClose" })}
        onCustomerNameChange={() => undefined}
        onCustomerPhoneChange={() => undefined}
        onOrderNoteChange={(value) => dispatch({ type: "note", value })}
        paymentMethod={isTakeaway ? state.paymentMethod : undefined}
        checkoutLabel={isTakeaway ? "Pay and send to kitchen" : undefined}
        onPaymentMethodChange={
          isTakeaway ? (value) => dispatch({ type: "paymentMethod", value }) : undefined
        }
        onChangeQuantity={changeQuantity}
        onRemove={removeFromCart}
        onClearCart={() => {
          clearCart();
          dispatch({ type: "cleared" });
        }}
        onCheckout={sendOrder}
      />
    </main>
  );
}
