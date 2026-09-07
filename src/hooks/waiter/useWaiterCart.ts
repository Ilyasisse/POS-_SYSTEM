"use client";

import { useState } from "react";
import type { CartLine, Product, SelectedModifierLine, Station } from "@/lib/types";

type ProductWithConfiguration = Product & {
  finalPrice?: number;
  selectedModifiers?: SelectedModifierLine[];
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  station?: Station;
};

function buildModifierSignature(modifiers: SelectedModifierLine[]) {
  return modifiers
    .map((modifier) => `${modifier.optionId}:${modifier.qty}`)
    .sort()
    .join("|");
}

function buildCartLineKey(product: {
  id: string;
  price?: number;
  isOpenPrice?: boolean;
  station?: Station;
  assignedUserId?: string | null;
  selectedModifiers?: SelectedModifierLine[];
}) {
  const modifierSignature = buildModifierSignature(
    Array.isArray(product.selectedModifiers) ? product.selectedModifiers : [],
  );
  const station = product.station ?? "NO_STATION";
  const assignedUserId = product.assignedUserId ?? "UNASSIGNED";
  const openPrice = product.isOpenPrice
    ? Number(product.price ?? 0).toFixed(2)
    : "FIXED_PRICE";

  return [
    product.id,
    station,
    assignedUserId,
    modifierSignature,
    openPrice,
  ].join("__");
}

function calculateLineTotal(unitPrice: number, quantity: number) {
  return Number(unitPrice) * quantity;
}

export function useWaiterCart() {
  const [cart, setCart] = useState<CartLine[]>([]);

  const addToCart = (product: ProductWithConfiguration) => {
    setCart((current) => {
      const station = product.station ?? product.category?.station ?? null;
      const selectedModifiers = Array.isArray(product.selectedModifiers)
        ? product.selectedModifiers
        : [];
      const unitPrice = Number(product.finalPrice ?? product.price);
      const cartKey = buildCartLineKey({
        id: product.id,
        price: Number(product.price),
        isOpenPrice: product.isOpenPrice,
        station,
        assignedUserId: product.assignedUserId ?? null,
        selectedModifiers,
      });

      const existing = current.find((item) => item.cartKey === cartKey);

      if (!existing) {
        return [
          ...current,
          {
            cartKey,
            id: product.id,
            name: product.name,
            product,
            price: Number(product.price),
            pronunciationAudioUrl: product.pronunciationAudioUrl ?? null,
            finalPrice: unitPrice,
            lineTotal: unitPrice,
            quantity: 1,
            station,
            selectedModifiers,
            assignedUserId: product.assignedUserId ?? null,
            assignedUserName: product.assignedUserName ?? null,
          },
        ];
      }

      return current.map((item) =>
        item.cartKey === cartKey
          ? {
              ...item,
              quantity: item.quantity + 1,
              lineTotal: calculateLineTotal(unitPrice, item.quantity + 1),
            }
          : item,
      );
    });
  };

  const changeQuantity = (cartKey: string, delta: number) => {
    setCart((current) =>
      current.flatMap((item) => {
        if (item.cartKey !== cartKey) {
          return [item];
        }

        const nextQuantity = item.quantity + delta;

        return nextQuantity > 0
          ? [
              {
                ...item,
                quantity: nextQuantity,
                lineTotal: calculateLineTotal(
                  Number(item.finalPrice ?? item.price),
                  nextQuantity,
                ),
              },
            ]
          : [];
      }),
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const removeFromCart = (cartKey: string) => {
    setCart((current) => current.filter((item) => item.cartKey !== cartKey));
  };

  const calculateCartTotal = () => {
    return cart.reduce(
      (total, item) =>
        total + Number(item.finalPrice ?? item.price) * item.quantity,
      0,
    );
  };

  return {
    cart,
    addToCart,
    changeQuantity,
    removeFromCart,
    clearCart,
    calculateCartTotal,
  };
}
