export const SHIFT_BROWSER_PAGE_SIZE = 25;

export function shiftBrowserPage(rawPage: string | undefined, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / SHIFT_BROWSER_PAGE_SIZE));
  const requested = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(requested)
    ? Math.min(Math.max(requested, 1), pageCount)
    : 1;
  return { page, pageCount, skip: (page - 1) * SHIFT_BROWSER_PAGE_SIZE };
}
