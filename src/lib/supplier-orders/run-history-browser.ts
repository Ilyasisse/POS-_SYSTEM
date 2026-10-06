export const RUN_HISTORY_PAGE_SIZE = 25;
export const runHistoryStatuses = [
  "ALL",
  "SCHEDULED",
  "COLLECTING",
  "FINALIZING",
  "SENT",
  "SKIPPED",
  "FAILED",
  "CANCELLED",
] as const;

export function runHistoryParams(
  status: string | undefined,
  page: string | undefined,
) {
  const selected =
    runHistoryStatuses.find((choice) => choice === status) ?? "ALL";
  const requestedPage = Number(page);
  return {
    status: selected,
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
  };
}

export function runHistoryPage(page: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / RUN_HISTORY_PAGE_SIZE));
  return { page: Math.min(page, pages), pages };
}
