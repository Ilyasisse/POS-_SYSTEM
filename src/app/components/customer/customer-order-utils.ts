"use client";

import type { Product, SelectedModifierLine } from "@/lib/types";
import { getCustomerModifierGroups } from "./customer-fallbacks";

export type SelectedModifiersMap = Record<string, string[]>;

export type CustomerOrderResponse = {
  success: boolean;
  order?: {
    id: string;
    orderNumber: number;
    total: number;
    createdAt: string;
  };
  kitchenTicket?: import("@/lib/kitchen-socket").KitchenTicket | null;
  error?: string;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value) || 0);
}

export function buildModifierLines(
  product: Product,
  selectedModifiers: SelectedModifiersMap,
): SelectedModifierLine[] {
  const modifierGroups = getCustomerModifierGroups(product);

  return modifierGroups.flatMap((group) =>
    group.options
      .filter((option) => (selectedModifiers[group.id] || []).includes(option.id))
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
}

export function calculateConfiguredPrice(
  product: Product,
  selectedModifiers: SelectedModifiersMap,
) {
  const modifierTotal = buildModifierLines(product, selectedModifiers).reduce(
    (sum, modifier) => sum + modifier.price * modifier.qty,
    0,
  );

  return (Number(product.price) || 0) + modifierTotal;
}
