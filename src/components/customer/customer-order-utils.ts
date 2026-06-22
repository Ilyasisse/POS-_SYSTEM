"use client";

import type { ModifierGroup, Product, SelectedModifierLine } from "@/lib/types";

export type SelectedModifiersMap = Record<string, string[]>;

export type CustomerOrderResponse = {
  success: boolean;
  order?: {
    id: string;
    orderNumber: number;
    total: number;
    createdAt: string;
  };
  kitchenTicket?: import("@/lib/kitchen/kitchen-socket").KitchenTicket | null;
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value) || 0);
}

export function getProductModifierGroups(product: Product): ModifierGroup[] {
  return Array.isArray(product.modifierGroups) ? product.modifierGroups : [];
}

export function getProductImage(product: Product) {
  const imageUrl = product.imageUrl?.trim();

  return imageUrl || "/newer_logo.png";
}

export function hasProductImage(product: Product) {
  return Boolean(product.imageUrl?.trim());
}

export function buildModifierLines(
  product: Product,
  selectedModifiers: SelectedModifiersMap,
): SelectedModifierLine[] {
  const modifierGroups = getProductModifierGroups(product);

  return modifierGroups.flatMap((group) => {
    const selectedOptionIds = selectedModifiers[group.id] || [];

    return group.options.flatMap((option) =>
      selectedOptionIds.includes(option.id)
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
  });
}
