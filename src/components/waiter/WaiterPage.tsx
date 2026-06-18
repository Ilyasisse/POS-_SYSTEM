"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getKitchenSocketUrl } from "@/lib/kitchen/kitchen-socket";
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
import WaiterPageSkeleton from "./WaiterPageSkeleton";
import { useWaiterCart } from "@/hooks/waiter/useWaiterCart";
import { useWaiterSocket } from "@/hooks/waiter/useWaiterSocket";
import { useWaiterData } from "@/hooks/waiter/useWaiterData";
import type { UserRole } from "@prisma/client";
import {
  buildFullOrderPronunciationSegments,
  cancelPronunciationPlayback,
  playPronunciationSegments,
} from "@/lib/waiter/waiter-pronunciation";

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
  totalSales: number;
  nextSalesResetAt: string;
  currentUserRole: UserRole;
  canPlaceOrders: boolean;
  orderingNotice: string | null;
  openingBalance: number;
};

function canSelectAllCategories(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
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

export default function WaiterPage({
  fullName,
  totalSales,
  nextSalesResetAt,
  currentUserRole,
  canPlaceOrders,
  orderingNotice,
  openingBalance,
}: WaiterPageProps) {
  const router = useRouter();
  const socketUrl = useMemo(() => getKitchenSocketUrl(), []);
  const { socketStatus, statusMessage, setStatusMessage, sendKitchenTicket } =
    useWaiterSocket(socketUrl);

  const { products, categories, paymentMethods, loading, productsAll, baristas } =
    useWaiterData();

  const {
    cart,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    calculateCartTotal,
  } = useWaiterCart();
  const showAllCategoryButton = canSelectAllCategories(currentUserRole);

  const [orderNote, setOrderNote] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    showAllCategoryButton ? "All" : "",
  );
  const [selectedPayment, setSelectedPayment] = useState<string>("GOLIS");

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false);

  const [lastReceipt, setLastReceipt] = useState<ReceiptSnapshot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTotalSales, setCurrentTotalSales] = useState(totalSales);
  const [currentCanPlaceOrders, setCurrentCanPlaceOrders] =
    useState(canPlaceOrders);
  const [currentOrderingNotice, setCurrentOrderingNotice] =
    useState(orderingNotice);
  const [currentOpeningBalance, setCurrentOpeningBalance] =
    useState(openingBalance);
  const balanceAmount = currentOpeningBalance + currentTotalSales;

  useEffect(() => {
    setCurrentTotalSales(totalSales);
  }, [totalSales]);

  useEffect(() => {
    setCurrentCanPlaceOrders(canPlaceOrders);
  }, [canPlaceOrders]);

  useEffect(() => {
    setCurrentOrderingNotice(orderingNotice);
  }, [orderingNotice]);

  useEffect(() => {
    setCurrentOpeningBalance(openingBalance);
  }, [openingBalance]);

  useEffect(() => {
    if (categories.length === 0) {
      if (!showAllCategoryButton && selectedCategory !== "") {
        setSelectedCategory("");
      }
      return;
    }

    if (showAllCategoryButton) {
      if (!selectedCategory) {
        setSelectedCategory("All");
      }
      return;
    }

    const categoryExists = categories.some(
      (category) => category.id === selectedCategory,
    );

    if (selectedCategory === "All" || !categoryExists) {
      setSelectedCategory(categories[0]?.id ?? "");
    }
  }, [categories, selectedCategory, showAllCategoryButton]);

  useEffect(() => {
    const resetAt = new Date(nextSalesResetAt).getTime();
    const delay = resetAt - Date.now();

    if (Number.isNaN(resetAt)) {
      return;
    }

    if (delay <= 0) {
      router.refresh();
      return;
    }

    const timer = window.setTimeout(() => {
      setCurrentTotalSales(0);
      router.refresh();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [nextSalesResetAt, router]);

  useEffect(() => {
    if (currentUserRole !== "WAITER") {
      return;
    }

    let cancelled = false;

    const syncShiftStatus = async () => {
      try {
        const response = await fetch("/api/waiter/shift-status", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          canPlaceOrders?: boolean;
          orderingNotice?: string | null;
          openingBalance?: number;
        };

        if (cancelled) {
          return;
        }

        const nextCanPlaceOrders = Boolean(data.canPlaceOrders);
        const nextOrderingNotice =
          typeof data.orderingNotice === "string" ? data.orderingNotice : null;
        const nextOpeningBalance =
          typeof data.openingBalance === "number"
            ? data.openingBalance
            : currentOpeningBalance;

        setCurrentCanPlaceOrders(nextCanPlaceOrders);
        setCurrentOrderingNotice(nextOrderingNotice);
        setCurrentOpeningBalance(nextOpeningBalance);

        if (
          nextCanPlaceOrders !== currentCanPlaceOrders ||
          nextOrderingNotice !== currentOrderingNotice ||
          nextOpeningBalance !== currentOpeningBalance
        ) {
          router.refresh();
        }
      } catch {
        // Keep the waiter page usable even if background sync fails.
      }
    };

    void syncShiftStatus();

    const interval = window.setInterval(() => {
      void syncShiftStatus();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    currentCanPlaceOrders,
    currentOpeningBalance,
    currentOrderingNotice,
    currentUserRole,
    router,
  ]);

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
    if (!currentCanPlaceOrders) {
      setStatusMessage(
        currentOrderingNotice ??
          "Go to the cashier and enter your opening balance before ordering.",
      );
      return;
    }

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

  async function handleCompleteSale() {
    if (!currentCanPlaceOrders) {
      setStatusMessage(
        currentOrderingNotice ??
          "Go to the cashier and enter your opening balance before ordering.",
      );
      return;
    }

    if (cart.length === 0) {
      setStatusMessage("Add items before completing the sale.");
      return;
    }

    try {
      cancelPronunciationPlayback();
      setIsSubmitting(true);
      setStatusMessage("Processing sale...");

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
        throw new Error(data?.error || "The sale could not be completed.");
      }

      setLastReceipt(data.receipt ?? null);
      setCurrentTotalSales(
        (current) => current + Number(data.receipt?.total ?? 0),
      );

      if (data.kitchenTicket) {
        sendKitchenTicket(data.kitchenTicket);
      }

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

  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-blue-100 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-blue-200/30">
          <HeaderWaiter fullName={fullName} balanceAmount={balanceAmount} />

          {!currentCanPlaceOrders && currentOrderingNotice ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-base font-semibold text-red-700 md:text-lg">
              {currentOrderingNotice}
            </div>
          ) : null}

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

        <CurrentOrderPanel
          cart={cart}
          socketStatus={socketStatus}
          orderNote={orderNote}
          onOrderNoteChange={setOrderNote}
          paymentMethods={paymentMethods}
          selectedPayment={selectedPayment}
          onSelectPayment={setSelectedPayment}
          onChangeQuantity={changeQuantity}
          onRemoveItem={removeFromCart}
          onPlayOrder={handlePlayFullOrder}
          total={calculateCartTotal()}
          onClear={() => {
            cancelPronunciationPlayback();
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
