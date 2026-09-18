import type {
  CartLine,
  Product,
  SelectedModifierLine,
  StaffSummary,
} from "@/lib/types";

const DRAFT_KEY = "customer-order-draft-v1";
type DraftItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
  modifiers: { optionId: string; qty: number }[];
  assignedBaristaId: string | null;
};
type Draft = {
  version: 1;
  items: DraftItem[];
  customerName: string;
  customerPhone: string;
  orderNote: string;
};

export function clearCustomerOrderDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage can be disabled by the browser.
  }
}

export function saveCustomerOrderDraft(
  cart: CartLine[],
  customerName: string,
  customerPhone: string,
  orderNote: string,
): boolean {
  const draft: Draft = {
    version: 1,
    items: cart.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
      unitPrice: Number(item.finalPrice ?? item.price),
      modifiers: item.selectedModifiers.map((modifier) => ({
        optionId: modifier.optionId,
        qty: modifier.qty,
      })),
      assignedBaristaId: item.assignedUserId ?? null,
    })),
    customerName,
    customerPhone,
    orderNote,
  };
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function validItem(value: unknown): value is DraftItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DraftItem>;
  return (
    typeof item.productId === "string" &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) > 0 &&
    Number(item.quantity) <= 99 &&
    typeof item.unitPrice === "number" &&
    Number.isFinite(item.unitPrice) &&
    Array.isArray(item.modifiers) &&
    item.modifiers.every(
      (modifier) =>
        modifier &&
        typeof modifier.optionId === "string" &&
        Number.isInteger(modifier.qty) &&
        modifier.qty > 0 &&
        modifier.qty <= 99,
    ) &&
    (item.assignedBaristaId === null ||
      typeof item.assignedBaristaId === "string")
  );
}

function restoreLine(
  item: DraftItem,
  products: Map<string, Product>,
  baristas: Map<string, StaffSummary>,
): { line: CartLine; repriced: boolean } | null {
  const product = products.get(item.productId);
  if (!product) return null;

  const selectedModifiers: SelectedModifierLine[] = [];
  for (const requested of item.modifiers) {
    const group = product.modifierGroups?.find((candidate) =>
      candidate.options.some((option) => option.id === requested.optionId),
    );
    const option = group?.options.find(
      (candidate) => candidate.id === requested.optionId,
    );
    if (!group || !option) return null;
    selectedModifiers.push({
      groupId: group.id,
      groupName: group.name,
      optionId: option.id,
      optionName: option.name,
      price: Number(option.price),
      qty: requested.qty,
      pronunciationAudioUrl: option.pronunciationAudioUrl ?? null,
    });
  }

  for (const group of product.modifierGroups ?? []) {
    const count = selectedModifiers.filter(
      (modifier) => modifier.groupId === group.id,
    ).length;
    const minimum = group.minSelect ?? (group.required ? 1 : 0);
    const maximum =
      group.maxSelect ?? (group.multiple ? group.options.length : 1);
    if (count < minimum || count > maximum) return null;
  }

  const station = product.category?.station ?? null;
  const selectedBarista = item.assignedBaristaId
    ? baristas.get(item.assignedBaristaId)
    : null;
  if (station === "BARISTA" && !selectedBarista) return null;
  const assignedUserId =
    station === "BARISTA" ? (selectedBarista?.id ?? null) : null;
  const assignedUserName =
    station === "BARISTA" ? (selectedBarista?.fullName ?? null) : null;
  const price = Number(product.price);
  const finalPrice =
    price +
    selectedModifiers.reduce(
      (sum, modifier) => sum + modifier.price * modifier.qty,
      0,
    );
  const cartKey = [
    product.id,
    station ?? "NO_STATION",
    assignedUserId ?? "UNASSIGNED",
    selectedModifiers
      .map((modifier) => `${modifier.optionId}:${modifier.qty}`)
      .sort()
      .join("|"),
  ].join("__");
  return {
    line: {
      cartKey,
      id: product.id,
      name: product.name,
      product,
      price,
      pronunciationAudioUrl: product.pronunciationAudioUrl ?? null,
      finalPrice,
      lineTotal: finalPrice * item.quantity,
      quantity: item.quantity,
      station,
      selectedModifiers,
      assignedUserId,
      assignedUserName,
    },
    repriced: Math.abs(finalPrice - item.unitPrice) > 0.005,
  };
}

export function restoreCustomerOrderDraft(
  products: Product[],
  baristas: StaffSummary[],
) {
  let parsed: unknown;
  try {
    const stored = sessionStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    parsed = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const draft = parsed as Partial<Draft>;
  if (draft.version !== 1 || !Array.isArray(draft.items)) return null;

  const productMap = new Map(products.map((product) => [product.id, product]));
  const baristaMap = new Map(baristas.map((barista) => [barista.id, barista]));
  const cart: CartLine[] = [];
  let skipped = 0;
  let repriced = 0;
  for (const value of draft.items) {
    const restored = validItem(value)
      ? restoreLine(value, productMap, baristaMap)
      : null;
    if (restored) {
      cart.push(restored.line);
      if (restored.repriced) repriced++;
    } else skipped++;
  }
  return {
    cart,
    customerName:
      typeof draft.customerName === "string" ? draft.customerName : "",
    customerPhone:
      typeof draft.customerPhone === "string" ? draft.customerPhone : "",
    orderNote: typeof draft.orderNote === "string" ? draft.orderNote : "",
    skipped,
    repriced,
  };
}
