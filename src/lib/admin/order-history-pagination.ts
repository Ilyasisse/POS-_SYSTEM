export function parseOrderHistorySearch(query: string): number | null {
  const value = query.trim().replace(/^#/, "");
  if (!/^[1-9]\d*$/.test(value)) return null;
  const orderNumber = Number(value);
  return Number.isSafeInteger(orderNumber) && orderNumber <= 2_147_483_647
    ? orderNumber
    : null;
}

export function orderHistoryPage(
  rawPage: string | undefined,
  matchingCount: number,
  pageSize: number,
): number {
  const requestedPage = Number(rawPage);
  const validPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  return Math.min(validPage, Math.max(1, Math.ceil(matchingCount / pageSize)));
}
