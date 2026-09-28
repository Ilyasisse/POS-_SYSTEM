export const MOVEMENT_HISTORY_PAGE_SIZE = 30;

export function movementHistoryPage(
  rawPage: string | undefined,
  total: number,
) {
  const pageCount = Math.max(1, Math.ceil(total / MOVEMENT_HISTORY_PAGE_SIZE));
  const requested = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(requested)
    ? Math.min(Math.max(requested, 1), pageCount)
    : 1;
  return { page, pageCount, skip: (page - 1) * MOVEMENT_HISTORY_PAGE_SIZE };
}
