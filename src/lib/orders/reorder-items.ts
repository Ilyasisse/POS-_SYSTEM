import type { Product, SelectedModifierLine, StaffSummary } from "@/lib/types";

export type PreviousOrderItem = {
  productId: string;
  qty: number;
  assignedUserId: string | null;
  modifiers: Array<{ modifierId: string; qty: number }>;
};

export type ReorderLine = {
  product: Product;
  quantity: number;
  selectedModifiers: SelectedModifierLine[];
  assignedUserId: string | null;
  assignedUserName: string | null;
  finalPrice: number;
};

export function buildReorderLines(
  previousItems: PreviousOrderItem[],
  products: Product[],
  baristas: StaffSummary[],
) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const baristaMap = new Map(baristas.map((barista) => [barista.id, barista]));
  const lines: ReorderLine[] = [];
  let unavailableItems = 0;

  for (const previous of previousItems) {
    const product = productMap.get(previous.productId);
    if (!product) {
      unavailableItems += previous.qty;
      continue;
    }
    const options = new Map(
      (product.modifierGroups ?? []).flatMap((group) =>
        group.options.map((option) => [
          option.id,
          { group, option },
        ] as const),
      ),
    );
    const selectedModifiers = previous.modifiers.flatMap((saved) => {
      const current = options.get(saved.modifierId);
      return current
        ? [{
            groupId: current.group.id,
            groupName: current.group.name,
            optionId: current.option.id,
            optionName: current.option.name,
            price: Number(current.option.price),
            qty: Math.max(1, saved.qty),
            pronunciationAudioUrl: current.option.pronunciationAudioUrl ?? null,
          } satisfies SelectedModifierLine]
        : [];
    });
    if (selectedModifiers.length !== previous.modifiers.length) {
      unavailableItems += previous.qty;
      continue;
    }
    const barista = previous.assignedUserId
      ? baristaMap.get(previous.assignedUserId)
      : null;
    lines.push({
      product,
      quantity: Math.max(1, previous.qty),
      selectedModifiers,
      assignedUserId: barista?.id ?? null,
      assignedUserName: barista?.fullName ?? null,
      finalPrice:
        Number(product.price) +
        selectedModifiers.reduce(
          (sum, modifier) => sum + modifier.price * modifier.qty,
          0,
        ),
    });
  }

  return { lines, unavailableItems };
}
