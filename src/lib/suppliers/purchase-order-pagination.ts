export const PURCHASE_ORDER_PAGE_SIZE = 50;

export function purchaseOrderPage(raw: string | undefined, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / PURCHASE_ORDER_PAGE_SIZE));
  const requested = raw && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
  const page = Math.min(requested, totalPages);

  return {
    page,
    totalPages,
    skip: (page - 1) * PURCHASE_ORDER_PAGE_SIZE,
  };
}

export function purchaseOrderFilterQuery(supplier?: string, status?: string) {
  const query = new URLSearchParams();
  if (supplier) query.set("supplier", supplier);
  if (status) query.set("status", status);
  return query.size ? `?${query.toString()}` : "";
}
