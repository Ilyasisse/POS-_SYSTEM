"use client";

import { useMemo, useState } from "react";
import { getKitchenSocketUrl } from "@/lib/kitchen-socket";
import type {
  Product,
  ReceiptSnapshot,
  SelectedModifierLine,
  Station,
} from "@/lib/types";
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

type ProductWithConfiguration = Product & {
  station?: Station;
  selectedModifiers?: SelectedModifierLine[];
  finalPrice?: number;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
};

type WaiterPageProps = {
  fullName: string;
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

export default function WaiterPage({ fullName }: WaiterPageProps) {
  const socketUrl = useMemo(() => getKitchenSocketUrl(), []);
  const { socketStatus, statusMessage, setStatusMessage, sendKitchenTicket } =
    useWaiterSocket(socketUrl);

  const { products, categories, paymentMethods, loading, productsAll, baristas } =
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

  async function handleCompleteSale() {
    if (cart.length === 0) {
      setStatusMessage("Ku dar alaabo ka hor intaadan iibka dhammayn.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage("Iibka waa la farsameynayaa...");

      const payload = {
        items: cart.map((item) => ({
          productId: item.id,
          qty: item.quantity,
          assignedBaristaId: item.assignedUserId ?? null,
          modifiers: item.selectedModifiers.map((modifier) => ({
            modifierId: modifier.optionId,
            qty: modifier.qty,
          })),
        })),
        paymentMethod: selectedPayment,
        notes: orderNote,
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
        throw new Error(data?.error || "Iibka lama dhammaystiri karin.");
      }

      setLastReceipt(data.receipt ?? null);

      if (data.kitchenTicket) {
        sendKitchenTicket(data.kitchenTicket);
      }

      clearCart();
      setOrderNote("");
      setStatusMessage("Iibka si guul leh ayuu u dhammaaday.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Waxbaa khaldamay.",
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
    return <p className="p-6">Waa la soo gelinayaa...</p>;
  }

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-blue-100 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-blue-200/30">
          <HeaderWaiter fullName={fullName} />

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
        key={`${selectedProduct?.id ?? "empty"}-${isModifierModalOpen ? "open" : "closed"}`}
        open={isModifierModalOpen}
        product={selectedProduct}
        baristas={baristas}
        onClose={closeConfigurationModal}
        onConfirm={handleModifierConfirm}
      />
    </main>
  );
}
