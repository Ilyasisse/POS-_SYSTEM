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

export function buildCartLineKey(product: {
  id: string;
  station?: Station;
  assignedUserId?: string | null;
  selectedModifiers?: SelectedModifierLine[];
}) {
  const modifierSignature = buildModifierSignature(
    Array.isArray(product.selectedModifiers) ? product.selectedModifiers : [],
  );
  const station = product.station ?? "NO_STATION";
  const assignedUserId = product.assignedUserId ?? "UNASSIGNED";

  return [product.id, station, assignedUserId, modifierSignature].join("__");
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
            finalPrice: unitPrice,
            lineTotal: unitPrice,
            sku: product.sku ?? "",
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
      current
        .map((item) => {
          if (item.cartKey !== cartKey) {
            return item;
          }

          const nextQuantity = item.quantity + delta;

          return {
            ...item,
            quantity: nextQuantity,
            lineTotal: calculateLineTotal(
              Number(item.finalPrice ?? item.price),
              nextQuantity,
            ),
          };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const clearCart = () => {
    setCart([]);
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
    clearCart,
    calculateCartTotal,
  };
}
