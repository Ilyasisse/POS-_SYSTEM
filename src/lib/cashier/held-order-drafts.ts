import { z } from "zod";
import type { CartLine, Product, StaffSummary } from "@/lib/types";

export const HELD_ORDER_STORAGE_KEY = "mashallah-cafe:cashier-held-orders:v1";
export const MAX_HELD_ORDERS = 20;

const heldItemSchema = z.object({
  productId: z.string().min(1).max(191),
  quantity: z.number().int().min(1).max(99),
  modifierOptionIds: z.array(z.string().min(1).max(191)).max(30),
  assignedUserId: z.string().min(1).max(191).nullable(),
});

const heldOrderSchema = z.object({
  id: z.string().min(1).max(191),
  label: z.string().min(1).max(80),
  tableId: z.string().min(1).max(191),
  tableName: z.string().min(1).max(100),
  orderNote: z.string().max(500),
  savedAt: z.string().datetime(),
  items: z.array(heldItemSchema).min(1).max(100),
});

export type HeldOrderDraft = z.infer<typeof heldOrderSchema>;

export function parseHeldOrderDrafts(value: string | null): HeldOrderDraft[] {
  if (!value) return [];
  try {
    const parsed = z.array(heldOrderSchema).max(MAX_HELD_ORDERS).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function createHeldOrderDraft(input: {
  id: string;
  label: string;
  tableId: string;
  tableName: string;
  orderNote: string;
  savedAt: string;
  cart: readonly CartLine[];
}): HeldOrderDraft {
  return heldOrderSchema.parse({
    ...input,
    label: input.label.trim(),
    orderNote: input.orderNote.trim(),
    items: input.cart.map((line) => ({
      productId: line.id,
      quantity: line.quantity,
      modifierOptionIds: line.selectedModifiers.map((modifier) => modifier.optionId),
      assignedUserId: line.assignedUserId ?? null,
    })),
  });
}

function cartKey(line: CartLine) {
  const modifierIds = line.selectedModifiers.map((modifier) => modifier.optionId).sort().join("|");
  return [line.id, line.station ?? "NO_STATION", line.assignedUserId ?? "UNASSIGNED", modifierIds].join("__");
}

export function restoreHeldOrderDraft(
  draft: HeldOrderDraft,
  products: readonly Product[],
  baristas: readonly StaffSummary[],
) {
  const cart: CartLine[] = [];
  let skippedItems = 0;

  for (const saved of draft.items) {
    const product = products.find((item) => item.id === saved.productId);
    if (!product) {
      skippedItems += 1;
      continue;
    }
    const optionIds = new Set(saved.modifierOptionIds);
    const selectedModifiers = (product.modifierGroups ?? []).flatMap((group) =>
      group.options.flatMap((option) => optionIds.has(option.id) ? [{
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        price: Number(option.price),
        qty: 1,
        pronunciationAudioUrl: option.pronunciationAudioUrl ?? null,
      }] : []),
    );
    if (selectedModifiers.length !== saved.modifierOptionIds.length) {
      skippedItems += 1;
      continue;
    }
    const selectionIsValid = (product.modifierGroups ?? []).every((group) => {
      const count = group.options.filter((option) => optionIds.has(option.id)).length;
      const minimum = group.minSelect ?? (group.required ? 1 : 0);
      const maximum = group.maxSelect ?? (group.multiple ? Number.POSITIVE_INFINITY : 1);
      return count >= minimum && count <= maximum;
    });
    if (!selectionIsValid) {
      skippedItems += 1;
      continue;
    }
    const assigned = saved.assignedUserId
      ? baristas.find((person) => person.id === saved.assignedUserId) ?? null
      : null;
    if (product.category?.station === "BARISTA" && !assigned) {
      skippedItems += 1;
      continue;
    }
    const unitPrice = Number(product.price) + selectedModifiers.reduce((sum, item) => sum + item.price, 0);
    const line: CartLine = {
      cartKey: "",
      id: product.id,
      name: product.name,
      product,
      price: Number(product.price),
      pronunciationAudioUrl: product.pronunciationAudioUrl ?? null,
      finalPrice: unitPrice,
      lineTotal: unitPrice * saved.quantity,
      quantity: saved.quantity,
      station: product.category?.station ?? null,
      selectedModifiers,
      assignedUserId: assigned?.id ?? null,
      assignedUserName: assigned?.fullName ?? null,
    };
    line.cartKey = cartKey(line);
    cart.push(line);
  }
  return { cart, skippedItems };
}
