"use client";

import { useDeferredValue, useMemo, useReducer, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAos } from "@/components/AosInitializer";
import { useWaiterCart } from "@/hooks/waiter/useWaiterCart";
import { useWaiterData } from "@/hooks/waiter/useWaiterData";
import type { Category, Product } from "@/lib/types";
import CustomerOrderHeader from "@/components/customer/UI/CustomerOrderHeader";
import MenuBrowserPanel from "@/components/customer/UI/MenuBrowserPanel";
import ProductGridPanel from "@/components/customer/UI/ProductGridPanel";
import CustomerModifierModal from "@/components/customer/CustomerModifierModal";
import CustomerCartSheet from "@/components/customer/CustomerCartSheet";
import {
  bodyFont,
  displayFont,
} from "@/components/customer/customer-order-styles";
import {
  buildModifierLines,
  getProductModifierGroups,
  type SelectedModifiersMap,
} from "@/components/customer/customer-order-utils";

type TableOption = { id: string; name: string };
type Props = { tables: TableOption[]; initialTableId?: string };
type State = {
  tableId: string;
  categoryId: string;
  searchTerm: string;
  orderNote: string;
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
      return { ...state, cartOpen: true, message: "", error: "" };
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
        className="max-w-2xl rounded-[2rem] border border-amber-100 bg-[#fffaf5] p-6 sm:p-8"
      >
        <DialogHeader>
          <DialogTitle
            className="text-center text-3xl text-stone-950 sm:text-4xl"
            style={{ fontFamily: displayFont }}
          >
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
                onClick={() => onSelect(table.id)}
                className="min-h-24 rounded-[1.5rem] border border-amber-200 bg-card text-xl font-semibold text-stone-950 shadow-sm hover:border-amber-400 hover:bg-amber-50"
              >
                {table.name}
              </Button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[1.5rem] border border-dashed border-border p-8 text-center text-muted-foreground">
            Every active table is currently occupied.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CashierOrderExperience({
  tables,
  initialTableId = "",
}: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    tableId: tables.some((table) => table.id === initialTableId)
      ? initialTableId
      : "",
    categoryId: "all",
    searchTerm: "",
    orderNote: "",
    selectedProduct: null,
    modifierOpen: false,
    cartOpen: false,
    submitting: false,
    message: "",
    error: "",
  });
  const { productsAll, categories, baristas, loading } = useWaiterData();
  const {
    cart,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    calculateCartTotal,
  } = useWaiterCart();
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
  const menuCategories = useMemo(
    () => getCategories(categories, products),
    [categories, products],
  );
  const categoryChips = useMemo(
    () => [
      { id: "all", name: "All", count: products.length },
      ...menuCategories.map((category) => ({
        id: category.id,
        name: category.name,
        count: products.filter(
          (product) => product.category?.id === category.id,
        ).length,
      })),
    ],
    [menuCategories, products],
  );
  const selectedCategory = categoryChips.some(
    (category) => category.id === state.categoryId,
  )
    ? state.categoryId
    : "all";
  const filteredProducts = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return products.filter(
      (product) =>
        (selectedCategory === "all" ||
          product.category?.id === selectedCategory) &&
        (!term ||
          product.name.toLowerCase().includes(term) ||
          (product.description ?? "").toLowerCase().includes(term)),
    );
  }, [deferredSearch, products, selectedCategory]);
  const tableName =
    tables.find((table) => table.id === state.tableId)?.name ?? "";
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const cartSubtotal = calculateCartTotal();
  useAos(
    cart.length,
    state.cartOpen,
    filteredProducts.length,
    isFiltering,
    state.modifierOpen,
    selectedCategory,
  );

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
  }

  function confirmModifiers(
    product: Product,
    selected: SelectedModifiersMap,
    baristaId: string | null,
  ) {
    const modifiers = buildModifierLines(product, selected);
    const barista = baristaId
      ? baristas.find((item) => item.id === baristaId)
      : null;
    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: modifiers,
      finalPrice:
        (Number(product.price) || 0) +
        modifiers.reduce(
          (sum, modifier) => sum + modifier.price * modifier.qty,
          0,
        ),
      assignedUserId: barista?.id ?? null,
      assignedUserName: barista?.fullName ?? null,
    });
    dispatch({ type: "modifierClose" });
    dispatch({ type: "added" });
  }

  async function sendOrder() {
    if (!state.tableId) {
      dispatch({
        type: "failed",
        error: "Select a table before sending the order.",
      });
      return;
    }
    if (!cart.length) {
      dispatch({
        type: "failed",
        error: "Add at least one item to the order.",
      });
      return;
    }
    try {
      dispatch({ type: "submitting" });
      const response = await fetch("/api/orders/table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: state.tableId,
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
      if (!response.ok)
        throw new Error(data?.error || "The table order could not be sent.");
      clearCart();
      router.push("/cashier?orderStatus=sent");
      router.refresh();
    } catch (error) {
      dispatch({
        type: "failed",
        error: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      dispatch({ type: "finished" });
    }
  }

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[linear-gradient(120deg,rgba(31,41,55,0.10)_0_1px,transparent_1px_100%),linear-gradient(180deg,#f4eadb_0%,#fffaf3_34%,#e7d1b1_100%)] bg-size[28px_28px,auto] text-foreground dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_100%),linear-gradient(180deg,#1d120d_0%,#2a1c15_45%,#17100c_100%)]"
      style={{ fontFamily: bodyFont }}
    >
      <TablePicker
        open={!state.tableId}
        tables={tables}
        onSelect={(value) => dispatch({ type: "table", value })}
      />
      <div className="relative mx-auto max-w-7xl px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
        <CustomerOrderHeader
          title="Cashier order"
          subtitle={
            tableName ? `Ordering for ${tableName}` : "Select a table to begin"
          }
          resetLabel="Clear order"
          cartLabel="Order"
          cartSubtotal={cartSubtotal}
          cartCount={cartCount}
          onReset={() => {
            clearCart();
            dispatch({ type: "cleared" });
          }}
          onOpenCart={() => dispatch({ type: "cartOpen" })}
        />
        <MenuBrowserPanel
          searchTerm={state.searchTerm}
          categoryChips={categoryChips}
          selectedCategory={selectedCategory}
          onSearchChange={(value) => dispatch({ type: "search", value })}
          onCategorySelect={(value) =>
            startFiltering(() => dispatch({ type: "category", value }))
          }
        />
        <ProductGridPanel
          loading={loading}
          filteredProducts={filteredProducts}
          baristas={baristas}
          selectedCategoryName={
            categoryChips.find((category) => category.id === selectedCategory)
              ?.name ?? "All"
          }
          isFiltering={isFiltering}
          onProductClick={addProduct}
        />
      </div>
      <CustomerModifierModal
        open={state.modifierOpen}
        product={state.selectedProduct}
        baristas={baristas}
        onClose={() => dispatch({ type: "modifierClose" })}
        onConfirm={confirmModifiers}
      />
      <CustomerCartSheet
        mode="cashier"
        tableName={tableName}
        open={state.cartOpen}
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
