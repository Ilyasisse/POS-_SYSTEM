"use client";

import { useMemo, useState } from "react";
import { getKitchenSocketUrl, KitchenStation } from "@/lib/kitchen-socket";
import type { Product, ReceiptSnapshot } from "@/lib/types";
import HeaderWaiter from "../waiter/HeaderWaiter";
import ProductQuickItems from "./ProductQuickItems";
import CategoryFilter from "./CategoryFilter";
import ProductSearch from "./ProductSearch";
import ProductGrid from "./ProductGrid";
import CurrentOrderPanel from "./CurrentOrderPanel";
import ModifierModal from "./ModifierModel";
import { useWaiterCart } from "@/hooks/useWaiterCart";
import { useWaiterSocket } from "@/hooks/useWaiterSocket";
import { useWaiterData } from "@/hooks/useWaiterData";

type SelectedModifiers = Record<string, string[]>;

export type SelectedModifierLine = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
};

type ProductWithModifiers = Product & {
  selectedModifiers?: SelectedModifierLine[];
  finalPrice?: number;
};

export default function WaiterPage() {
  const socketUrl = useMemo(() => getKitchenSocketUrl(), []);
  const { socketStatus, statusMessage, setStatusMessage, sendKitchenTicket } =
    useWaiterSocket(socketUrl);

  const { products, categories, paymentMethods, loading, productsAll } =
    useWaiterData();

  const { cart, addToCart, changeQuantity, clearCart, calculateCartTotal } =
    useWaiterCart();

  const [orderNote, setOrderNote] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPayment, setSelectedPayment] = useState<string>("GOLIS");

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);

  const [lastReceipt, setLastReceipt] = useState<ReceiptSnapshot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredProducts =
    selectedCategory === "All"
      ? productsAll
      : productsAll.filter(
          (product) => product.category?.id === selectedCategory,
        );

  const searchedProducts = filteredProducts.filter((product) => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) return true;

    return (
      product.name.toLowerCase().includes(term) ||
      (product.sku ?? "").toLowerCase().includes(term)
    );
  });

  function handleProductClick(product: Product) {
    const modifierGroups = Array.isArray(product.modifierGroups)
      ? product.modifierGroups
      : [];

    if (modifierGroups.length > 0) {
      setSelectedProduct(product);
      setIsModifierModalOpen(true);
      return;
    }

    addToCart(product);
  }

  async function handleCompleteSale(selectedBaristaId: string | null) {
    if (cart.length === 0) {
      setStatusMessage("Add items before completing the sale.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage("Processing sale...");

      const total = calculateCartTotal();

      const payload = {
        items: cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          qty: item.quantity,
          unitPrice: Number(item.finalPrice ?? item.price),
          lineTotal: Number(item.finalPrice ?? item.price) * item.quantity,
          modifiers: Array.isArray(item.selectedModifiers)
            ? item.selectedModifiers.map((modifier) => ({
                modifierId: modifier.optionId,
                modifierName: modifier.optionName,
                price: Number(modifier.price),
                qty: 1,
              }))
            : [],
        })),
        total,
        paymentMethod: selectedPayment,
        notes: orderNote,
        selectedBaristaId,
      };

      const response = await fetch("/api/orders/complete-sale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to complete sale.");
      }

      setLastReceipt(data.receipt ?? null);

      sendKitchenTicket({
        id: data.order.id,
        orderId: data.order.id,
        orderNumber: data.order.orderNumber,
        createdAt: new Date().toISOString(),
        status: "new",
        note: orderNote,
        assignedBaristaId: selectedBaristaId,
        items: cart
          .map((item, index) => {
            const station = item.product?.category?.station;

            let kitchenStation: KitchenStation | null = null;

            if (station === "KITCHEN") {
              kitchenStation = "KITCHEN";
            } else if (station === "BARISTA") {
              kitchenStation = "BARISTA";
            }

            if (!kitchenStation) {
              return null;
            }

            return {
              id: `${item.id}-${index}`,
              name: item.name,
              quantity: item.quantity,
              station: kitchenStation,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
      });

      clearCart();
      setOrderNote("");
      setStatusMessage("Sale completed successfully.");
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
  ) {
    const modifierGroups = Array.isArray(product.modifierGroups)
      ? product.modifierGroups
      : [];

    const modifierLines: SelectedModifierLine[] = modifierGroups.flatMap(
      (group) =>
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
          })),
    );

    const modifiersTotal = modifierLines.reduce(
      (sum, modifier) => sum + Number(modifier.price),
      0,
    );

    const productWithModifiers: ProductWithModifiers = {
      ...product,
      selectedModifiers: modifierLines,
      finalPrice: Number(product.price) + modifiersTotal,
    };

    addToCart(productWithModifiers as Product);

    setSelectedProduct(null);
    setIsModifierModalOpen(false);
  }

  if (loading) {
    return <p className="p-6">Loading...</p>;
  }

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-blue-100 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-blue-200/30">
          <HeaderWaiter />

          <ProductQuickItems
            products={products}
            onAddToCart={handleProductClick}
          />

          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          <ProductSearch
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
          />

          <ProductGrid
            products={searchedProducts}
            onAddToCart={handleProductClick}
          />
        </section>

        <CurrentOrderPanel
          cart={cart}
          socketStatus={socketStatus}
          orderNote={orderNote}
          onOrderNoteChange={setOrderNote}
          paymentMethods={paymentMethods}
          selectedPayment={selectedPayment}
          onSelectPayment={setSelectedPayment}
          onChangeQuantity={changeQuantity}
          total={calculateCartTotal()}
          onClear={() => {
            clearCart();
            setOrderNote("");
            setStatusMessage("");
          }}
          onCompleteSale={handleCompleteSale}
          isSubmitting={isSubmitting}
          statusMessage={statusMessage}
          lastReceipt={lastReceipt}
        />
      </div>

      <ModifierModal
        open={isModifierModalOpen}
        product={selectedProduct}
        onClose={() => {
          setSelectedProduct(null);
          setIsModifierModalOpen(false);
        }}
        onConfirm={handleModifierConfirm}
      />
    </main>
  );
}