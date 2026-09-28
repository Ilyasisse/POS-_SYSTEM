export const INVENTORY_PAGE_SIZE = 25;

export function paginateInventorySupplies<T>(
  items: readonly T[],
  rawPage?: string,
) {
  const pageCount = Math.max(1, Math.ceil(items.length / INVENTORY_PAGE_SIZE));
  const requested = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(requested)
    ? Math.min(Math.max(1, requested), pageCount)
    : 1;
  const start = (page - 1) * INVENTORY_PAGE_SIZE;
  return {
    page,
    pageCount,
    first: items.length === 0 ? 0 : start + 1,
    last: Math.min(start + INVENTORY_PAGE_SIZE, items.length),
    items: items.slice(start, start + INVENTORY_PAGE_SIZE),
  };
}
