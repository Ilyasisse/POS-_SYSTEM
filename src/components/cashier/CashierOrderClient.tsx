"use client";

import { Button } from "@/components/ui/button";

import { NativeSelect } from "@/components/ui/native-select";

import { Textarea } from "@/components/ui/textarea";

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CartLine,
  Category,
  Product,
  SelectedModifierLine,
  Station,
} from "@/lib/types";
import ProductQuickItems from "@/components/waiter/ProductQuickItems";
import CategoryFilter from "@/components/waiter/CategoryFilter";
import ProductSearch from "@/components/waiter/ProductSearch";
import ProductGrid from "@/components/waiter/ProductGrid";
import CartItemCard from "@/components/waiter/CartItemCard";
import ModifierModal from "@/components/waiter/ModifierModel";
import WaiterPageSkeleton from "@/components/waiter/WaiterPageSkeleton";
import { useWaiterCart } from "@/hooks/waiter/useWaiterCart";
import { useWaiterData } from "@/hooks/waiter/useWaiterData";
import {
  buildFullOrderPronunciationSegments,
  cancelPronunciationPlayback,
  playPronunciationSegments,
} from "@/lib/waiter/waiter-pronunciation";

type TableOption = {
  id: string;
  name: string;
};

type SelectedModifiers = Record<string, string[]>;

type ProductWithConfiguration = Product & {
  station?: Station;
  selectedModifiers?: SelectedModifierLine[];
  finalPrice?: number;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
};

type CashierOrderClientProps = {
  tables: TableOption[];
  initialTableId?: string;
};

type CashierProductPickerProps = {
  tables: TableOption[];
  products: Product[];
  categories: Category[];
  searchedProducts: Product[];
  selectedTableId: string;
  selectedCategory: string;
  searchTerm: string;
  onTableSelect: (tableId: string) => void;
  onCategorySelect: (category: string) => void;
  onSearchTermChange: (searchTerm: string) => void;
  onProductClick: (product: Product) => void;
  onPlayProduct: (product: Product) => void;
};

type CurrentTableOrderPanelProps = {
  cart: CartLine[];
  orderNote: string;
  total: number;
  isSubmitting: boolean;
  isDisabled: boolean;
  statusMessage: string;
  lastOrderMessage: string;
  onOrderNoteChange: (orderNote: string) => void;
  onChangeQuantity: (cartKey: string, delta: number) => void;
  onRemoveFromCart: (cartKey: string) => void;
  onClearOrder: () => void;
  onSendOrder: () => void;
  onPlayFullOrder: () => void;
};

type CashierOrderState = {
  selectedTableIdOverride: string;
  orderNote: string;
  searchTerm: string;
  selectedCategoryValue: string;
  selectedProduct: Product | null;
  isModifierModalOpen: boolean;
  isSubmitting: boolean;
  lastOrderMessage: string;
};

type CashierOrderAction =
  | { type: "tableSelected"; tableId: string }
  | { type: "orderNoteChanged"; orderNote: string }
  | { type: "searchTermChanged"; searchTerm: string }
  | { type: "categorySelected"; category: string }
  | { type: "configurationOpened"; product: Product }
  | { type: "configurationClosed" }
  | { type: "submitStarted" }
  | { type: "orderSent"; message: string }
  | { type: "submitFinished" }
  | { type: "orderCleared" };

const initialCashierOrderState: CashierOrderState = {
  selectedTableIdOverride: "",
  orderNote: "",
  searchTerm: "",
  selectedCategoryValue: "All",
  selectedProduct: null,
  isModifierModalOpen: false,
  isSubmitting: false,
  lastOrderMessage: "",
};

function cashierOrderReducer(
  state: CashierOrderState,
  action: CashierOrderAction,
): CashierOrderState {
  switch (action.type) {
    case "tableSelected":
      return { ...state, selectedTableIdOverride: action.tableId };
    case "orderNoteChanged":
      return { ...state, orderNote: action.orderNote };
    case "searchTermChanged":
      return { ...state, searchTerm: action.searchTerm };
    case "categorySelected":
      return { ...state, selectedCategoryValue: action.category };
    case "configurationOpened":
      return {
        ...state,
        selectedProduct: action.product,
        isModifierModalOpen: true,
      };
    case "configurationClosed":
      return {
        ...state,
        selectedProduct: null,
        isModifierModalOpen: false,
      };
    case "submitStarted":
      return {
        ...state,
        isSubmitting: true,
        lastOrderMessage: "",
      };
    case "orderSent":
      return {
        ...state,
        orderNote: "",
        lastOrderMessage: action.message,
      };
    case "submitFinished":
      return { ...state, isSubmitting: false };
    case "orderCleared":
      return { ...state, orderNote: "", lastOrderMessage: "" };
    default:
      return state;
  }
}

function requiresBaristaAssignment(product: Product) {
  return product.category?.station === "BARISTA";
}

function requiresConfiguration(product: Product) {
  return (
    requiresBaristaAssignment(product) ||
    (Array.isArray(product.modifierGroups) && product.modifierGroups.length > 0)
  );
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

function CashierProductPicker({
  tables,
  products,
  categories,
  searchedProducts,
  selectedTableId,
  selectedCategory,
  searchTerm,
  onTableSelect,
  onCategorySelect,
  onSearchTermChange,
  onProductClick,
  onPlayProduct,
}: CashierProductPickerProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/90 p-4 shadow-xl shadow-blue-200/30">
      <div className="grid gap-3 md:grid-cols-[1fr_0.8fr] md:items-end">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Take table order
          </h2>
          <p className="text-sm text-muted-foreground">
            Cashier sends food to the kitchen first. Payment is collected later.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-foreground">
            Table
          </span>
          <NativeSelect
            value={selectedTableId}
            onChange={(event) => onTableSelect(event.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 font-semibold outline-none focus:border-blue-500"
          >
            {tables.length === 0 ? (
              <option value="">No active tables</option>
            ) : (
              tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))
            )}
          </NativeSelect>
        </label>
      </div>

      <ProductQuickItems products={products} onAddToCart={onProductClick} />

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onCategorySelect}
        showAllCategoryButton
      />

      <ProductSearch
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
      />

      <ProductGrid
        products={searchedProducts}
        onAddToCart={onProductClick}
        onPlayPronunciation={onPlayProduct}
      />
    </section>
  );
}

function CurrentTableOrderPanel({
  cart,
  orderNote,
  total,
  isSubmitting,
  isDisabled,
  statusMessage,
  lastOrderMessage,
  onOrderNoteChange,
  onChangeQuantity,
  onRemoveFromCart,
  onClearOrder,
  onSendOrder,
  onPlayFullOrder,
}: CurrentTableOrderPanelProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/95 p-4 shadow-xl shadow-slate-300/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Current table order
          </h2>
          <p className="text-sm text-muted-foreground">
            Send to kitchen as an open order.
          </p>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Fadlan marka hore dalbo
          </p>
        ) : (
          cart.map((line) => (
            <CartItemCard
              key={line.cartKey}
              line={line}
              onChangeQuantity={onChangeQuantity}
              onRemove={onRemoveFromCart}
            />
          ))
        )}
      </div>

      <label htmlFor="cashier-order-note" className="block">
        <span className="mb-1 block text-sm font-semibold text-muted-foreground">
          Qoraallada Dalabka
        </span>
        <Textarea
          id="cashier-order-note"
          value={orderNote}
          onChange={(event) => onOrderNoteChange(event.target.value)}
          placeholder="Fadlan halkan ku qor qoraallada dalabka..."
          rows={3}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none transition focus:border-[#4F7CFF] focus:ring-2 focus:ring-blue-200"
        />
      </label>

      <div className="space-y-1 rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
        <div className="flex justify-between text-lg">
          <span>Totalka</span>
          <span className="text-green-300">
            ${roundToTwo(total).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={onClearOrder}
          className="min-h-11 rounded-lg bg-muted text-sm font-semibold text-foreground"
        >
          Nadiifi
        </Button>

        <Button
          type="button"
          onClick={onSendOrder}
          className="min-h-11 rounded-lg bg-[#2E7D32] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isDisabled}
        >
          {isSubmitting ? "Fadlan sug..." : "Send to kitchen"}
        </Button>
      </div>

      <Button
        type="button"
        onClick={onPlayFullOrder}
        disabled={cart.length === 0}
        className="min-h-10 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Ciyaar codka dalabka
      </Button>

      {statusMessage ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
          {statusMessage}
        </p>
      ) : null}

      {lastOrderMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {lastOrderMessage}
        </p>
      ) : null}
    </section>
  );
}

export default function CashierOrderClient({
  tables,
  initialTableId = "",
}: CashierOrderClientProps) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("");
  const { products, categories, loading, productsAll, baristas } =
    useWaiterData();
  const {
    cart,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    calculateCartTotal,
  } = useWaiterCart();

  const initialTableExists = tables.some(
    (table) => table.id === initialTableId,
  );
  const defaultTableId = initialTableExists
    ? initialTableId
    : (tables[0]?.id ?? "");
  const [orderState, dispatchOrderState] = useReducer(
    cashierOrderReducer,
    initialCashierOrderState,
  );
  const selectedTableId = orderState.selectedTableIdOverride || defaultTableId;
  const selectedCategory = orderState.selectedCategoryValue || "All";

  const filteredProducts =
    selectedCategory === "All"
      ? productsAll
      : productsAll.filter(
          (product) => product.category?.id === selectedCategory,
        );

  const searchedProducts = filteredProducts.filter((product) => {
    const term = orderState.searchTerm.toLowerCase().trim();

    if (!term) return true;

    return product.name.toLowerCase().includes(term);
  });

  function closeConfigurationModal() {
    dispatchOrderState({ type: "configurationClosed" });
  }

  function handleProductClick(product: Product) {
    if (requiresConfiguration(product)) {
      dispatchOrderState({ type: "configurationOpened", product });
      return;
    }

    addToCart({
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: [],
      finalPrice: Number(product.price),
    });
  }

  function handlePlayProduct(product: Product) {
    void playPronunciationSegments([
      {
        url: product.pronunciationAudioUrl ?? "",
        label: product.name,
      },
    ]).then((message) => {
      if (message) {
        setStatusMessage(message);
      }
    });
  }

  function handlePlayFullOrder() {
    if (cart.length === 0) {
      setStatusMessage("Marka hore dooro wax la akhriyo.");
      return;
    }

    void playPronunciationSegments(
      buildFullOrderPronunciationSegments(cart),
    ).then((message) => {
      if (message) {
        setStatusMessage(message);
      }
    });
  }

  async function handleSendOrder() {
    if (!selectedTableId) {
      setStatusMessage("Select a table before sending the order.");
      return;
    }

    if (cart.length === 0) {
      setStatusMessage("Add items before sending the order.");
      return;
    }

    try {
      cancelPronunciationPlayback();
      dispatchOrderState({ type: "submitStarted" });
      setStatusMessage("Sending table order...");

      const response = await fetch("/api/orders/table", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tableId: selectedTableId,
          items: cart.map((item) => ({
            productId: item.id,
            qty: item.quantity,
            assignedBaristaId: item.assignedUserId ?? null,
            modifiers: item.selectedModifiers.map((modifier) => ({
              modifierId: modifier.optionId,
              qty: modifier.qty,
            })),
          })),
          notes: orderState.orderNote,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "The table order could not be sent.");
      }

      clearCart();
      const orderNumber = data.order?.orderNumber ?? "";
      const roundNumber = data.order?.roundNumber ?? 1;
      dispatchOrderState({
        type: "orderSent",
        message: data.order?.appended
          ? `Round ${roundNumber} added to Order #${orderNumber} for ${data.order?.tableName ?? "table"}. Payment stays open.`
          : `Order #${orderNumber} sent to ${data.order?.tableName ?? "table"}. Payment stays open.`,
      });
      router.push("/cashier");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      dispatchOrderState({ type: "submitFinished" });
    }
  }

  function handleModifierConfirm(
    product: Product,
    selectedModifiers: SelectedModifiers,
    assignedBaristaId: string | null,
  ) {
    const modifierGroups = Array.isArray(product.modifierGroups)
      ? product.modifierGroups
      : [];
    const modifierLines: SelectedModifierLine[] = modifierGroups.flatMap(
      (group) => {
        const selectedOptionIds = selectedModifiers[group.id] || [];
        const selectedOptionIdSet = new Set(selectedOptionIds);

        return group.options.flatMap((option) =>
          selectedOptionIdSet.has(option.id)
            ? [
                {
                  groupId: group.id,
                  groupName: group.name,
                  optionId: option.id,
                  optionName: option.name,
                  price: Number(option.price),
                  qty: 1,
                  pronunciationAudioUrl: option.pronunciationAudioUrl ?? null,
                },
              ]
            : [],
        );
      },
    );
    const modifiersTotal = modifierLines.reduce(
      (sum, modifier) => sum + Number(modifier.price) * modifier.qty,
      0,
    );
    const assignedBarista =
      assignedBaristaId != null
        ? (baristas.find((barista) => barista.id === assignedBaristaId) ?? null)
        : null;

    const productWithConfiguration: ProductWithConfiguration = {
      ...product,
      station: product.category?.station ?? null,
      selectedModifiers: modifierLines,
      finalPrice: Number(product.price) + modifiersTotal,
      assignedUserId: assignedBarista?.id ?? null,
      assignedUserName: assignedBarista?.fullName ?? null,
    };

    addToCart(productWithConfiguration);
    closeConfigurationModal();
  }

  function handleClearOrder() {
    cancelPronunciationPlayback();
    clearCart();
    dispatchOrderState({ type: "orderCleared" });
    setStatusMessage("");
  }

  if (loading) {
    return <WaiterPageSkeleton />;
  }

  const isDisabled =
    orderState.isSubmitting || cart.length === 0 || !selectedTableId;
  const total = calculateCartTotal();

  return (
    <>
      <div className="grid w-full gap-6 lg:grid-cols-[1.6fr_1fr]">
        <CashierProductPicker
          tables={tables}
          products={products}
          categories={categories}
          searchedProducts={searchedProducts}
          selectedTableId={selectedTableId}
          selectedCategory={selectedCategory}
          searchTerm={orderState.searchTerm}
          onTableSelect={(tableId) =>
            dispatchOrderState({ type: "tableSelected", tableId })
          }
          onCategorySelect={(category) =>
            dispatchOrderState({ type: "categorySelected", category })
          }
          onSearchTermChange={(searchTerm) =>
            dispatchOrderState({ type: "searchTermChanged", searchTerm })
          }
          onProductClick={handleProductClick}
          onPlayProduct={handlePlayProduct}
        />

        <CurrentTableOrderPanel
          cart={cart}
          orderNote={orderState.orderNote}
          total={total}
          isSubmitting={orderState.isSubmitting}
          isDisabled={isDisabled}
          statusMessage={statusMessage}
          lastOrderMessage={orderState.lastOrderMessage}
          onOrderNoteChange={(orderNote) =>
            dispatchOrderState({ type: "orderNoteChanged", orderNote })
          }
          onChangeQuantity={changeQuantity}
          onRemoveFromCart={removeFromCart}
          onClearOrder={handleClearOrder}
          onSendOrder={handleSendOrder}
          onPlayFullOrder={handlePlayFullOrder}
        />
      </div>

      <ModifierModal
        key={`${orderState.selectedProduct?.id ?? "empty"}-${orderState.isModifierModalOpen ? "open" : "closed"}`}
        open={orderState.isModifierModalOpen}
        product={orderState.selectedProduct}
        baristas={baristas}
        onClose={closeConfigurationModal}
        onConfirm={handleModifierConfirm}
      />
    </>
  );
}
