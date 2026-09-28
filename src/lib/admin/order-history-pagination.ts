export const ORDER_HISTORY_PAGE_SIZE = 20;

export function orderHistoryPage(rawPage: string | undefined, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / ORDER_HISTORY_PAGE_SIZE));
  const requested = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(requested)
    ? Math.min(Math.max(1, requested), pageCount)
    : 1;
  const skip = (page - 1) * ORDER_HISTORY_PAGE_SIZE;
  return {
    page,
    pageCount,
    skip,
    first: total === 0 ? 0 : skip + 1,
    last: Math.min(skip + ORDER_HISTORY_PAGE_SIZE, total),
  };
}
