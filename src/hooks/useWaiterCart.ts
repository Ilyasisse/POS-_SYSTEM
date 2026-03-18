"use client";

import { useState } from "react";
import type { CartLine, Product, SelectedModifierLine } from "@/lib/types";

type ProductWithModifiers = Product & {
  finalPrice?: number;
  selectedModifiers?: SelectedModifierLine[];
};

function buildCartLineKey(product: ProductWithModifiers) {
  const modifierKey = Array.isArray(product.selectedModifiers)
    ? product.selectedModifiers
        .map((modifier) => modifier.optionId)
        .sort()
        .join("_")
    : "";

  return `${product.id}__${modifierKey}`;
}

export function useWaiterCart() {
  const [cart, setCart] = useState<CartLine[]>([]);

  const addToCart = (product: ProductWithModifiers) => {
    setCart((current) => {
      const cartKey = buildCartLineKey(product);

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
            finalPrice: Number(product.finalPrice ?? product.price),
            sku: product.sku ?? "",
            quantity: 1,
            selectedModifiers: product.selectedModifiers ?? [],
          },
        ];
      }

      return current.map((item) =>
        item.cartKey === cartKey
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    });
  };

  const changeQuantity = (cartKey: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.cartKey === cartKey
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
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
