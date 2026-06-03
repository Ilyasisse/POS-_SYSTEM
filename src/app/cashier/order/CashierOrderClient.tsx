"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getKitchenSocketUrl } from "@/lib/kitchen-socket";
import type { Product, SelectedModifierLine, Station } from "@/lib/types";
import ProductQuickItems from "@/app/components/waiter/ProductQuickItems";
import CategoryFilter from "@/app/components/waiter/CategoryFilter";
import ProductSearch from "@/app/components/waiter/ProductSearch";
import ProductGrid from "@/app/components/waiter/ProductGrid";
import CartItemCard from "@/app/components/waiter/CartItemCard";
import ModifierModal from "@/app/components/waiter/ModifierModel";
import WaiterPageSkeleton from "@/app/components/waiter/WaiterPageSkeleton";
import { useWaiterCart } from "@/hooks/useWaiterCart";
import { useWaiterData } from "@/hooks/useWaiterData";
import { useWaiterSocket } from "@/hooks/useWaiterSocket";
import {
  buildFullOrderPronunciationSegments,
  cancelPronunciationPlayback,
  playPronunciationSegments,
} from "@/lib/waiter-pronunciation";

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

export default function CashierOrderClient({
  tables,
  initialTableId = "",
}: CashierOrderClientProps) {
  const router = useRouter();
  const socketUrl = useMemo(() => getKitchenSocketUrl(), []);
  const { socketStatus, statusMessage, setStatusMessage, sendKitchenTicket } =
    useWaiterSocket(socketUrl);
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

  const showAllCategoryButton = true;
  const initialTableExists = tables.some((table) => table.id === initialTableId);
  const [selectedTableId, setSelectedTableId] = useState(
    initialTableExists ? initialTableId : (tables[0]?.id ?? ""),
  );
  const [orderNote, setOrderNote] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderMessage, setLastOrderMessage] = useState("");

  useEffect(() => {
    if (!selectedTableId && tables[0]?.id) {
      setSelectedTableId(tables[0].id);
    }
  }, [selectedTableId, tables]);

  useEffect(() => {
    if (!selectedCategory) {
      setSelectedCategory("All");
    }
  }, [selectedCategory]);

  const filteredProducts =
    selectedCategory === "All"
      ? productsAll
      : productsAll.filter(
          (product) => product.category?.id === selectedCategory,
        );

  const searchedProducts = filteredProducts.filter((product) => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) return true;

    return product.name.toLowerCase().includes(term);
  });

  function closeConfigurationModal() {
    setSelectedProduct(null);
    setIsModifierModalOpen(false);
  }

  function handleProductClick(product: Product) {
    if (requiresConfiguration(product)) {
      setSelectedProduct(product);
      setIsModifierModalOpen(true);
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
      setIsSubmitting(true);
      setLastOrderMessage("");
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
          notes: orderNote,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "The table order could not be sent.");
      }

      if (data.kitchenTicket) {
        sendKitchenTicket(data.kitchenTicket);
      }

      clearCart();
      setOrderNote("");
      setLastOrderMessage(
        `Order #${data.order?.orderNumber ?? ""} sent to ${data.order?.tableName ?? "table"}. Payment stays open.`,
      );
      router.push("/cashier");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setIsSubmitting(false);
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
    const modifierLines: SelectedModifierLine[] = modifierGroups.flatMap((group) =>
      group.options
        .filter((option) =>
          (selectedModifiers[group.id] || []).includes(option.id),
        )
        .map((option) => ({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          price: Number(option.price),
          qty: 1,
          pronunciationAudioUrl: option.pronunciationAudioUrl ?? null,
        })),
    );
    const modifiersTotal = modifierLines.reduce(
      (sum, modifier) => sum + Number(modifier.price) * modifier.qty,
      0,
    );
    const assignedBarista =
      assignedBaristaId != null
        ? baristas.find((barista) => barista.id === assignedBaristaId) ?? null
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

  if (loading) {
    return <WaiterPageSkeleton />;
  }

  const isDisabled = isSubmitting || cart.length === 0 || !selectedTableId;
  const total = calculateCartTotal();

  return (
    <>
      <div className="grid w-full gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-blue-200/30">
          <div className="grid gap-3 md:grid-cols-[1fr_0.8fr] md:items-end">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Take table order
              </h2>
              <p className="text-sm text-slate-500">
                Cashier sends food to the kitchen first. Payment is collected later.
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Table
              </span>
              <select
                value={selectedTableId}
                onChange={(event) => setSelectedTableId(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500"
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
              </select>
            </label>
          </div>

          <ProductQuickItems
            products={products}
            onAddToCart={handleProductClick}
          />

          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            showAllCategoryButton={showAllCategoryButton}
          />

          <ProductSearch
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
          />

          <ProductGrid
            products={searchedProducts}
            onAddToCart={handleProductClick}
            onPlayPronunciation={handlePlayProduct}
          />
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-300/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Current table order
              </h2>
              <p className="text-sm text-slate-500">
                Send to kitchen as an open order.
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${
                socketStatus === "connected"
                  ? "bg-green-100 text-green-700"
                  : socketStatus === "connecting"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {socketStatus}
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-500">
                Fadlan marka hore dalbo
              </p>
            ) : (
              cart.map((line) => (
                <CartItemCard
                  key={line.cartKey}
                  line={line}
                  onChangeQuantity={changeQuantity}
                  onRemove={removeFromCart}
                />
              ))
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-600">
              Qoraallada Dalabka
            </span>
            <textarea
              value={orderNote}
              onChange={(event) => setOrderNote(event.target.value)}
              placeholder="Fadlan halkan ku qor qoraallada dalabka..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#4F7CFF] focus:ring-2 focus:ring-blue-200"
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
            <button
              type="button"
              onClick={() => {
                cancelPronunciationPlayback();
                clearCart();
                setOrderNote("");
                setStatusMessage("");
                setLastOrderMessage("");
              }}
              className="min-h-11 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700"
            >
              Nadiifi
            </button>

            <button
              type="button"
              onClick={handleSendOrder}
              className="min-h-11 rounded-lg bg-[#2E7D32] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isDisabled}
            >
              {isSubmitting ? "Fadlan sug..." : "Send to kitchen"}
            </button>
          </div>

          <button
            type="button"
            onClick={handlePlayFullOrder}
            disabled={cart.length === 0}
            className="min-h-10 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ciyaar codka dalabka
          </button>

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
      </div>

      <ModifierModal
        key={`${selectedProduct?.id ?? "empty"}-${isModifierModalOpen ? "open" : "closed"}`}
        open={isModifierModalOpen}
        product={selectedProduct}
        baristas={baristas}
        onClose={closeConfigurationModal}
        onConfirm={handleModifierConfirm}
      />
    </>
  );
}
