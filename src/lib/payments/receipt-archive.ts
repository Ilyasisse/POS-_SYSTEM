import { isValidDateKey } from "@/lib/admin/admin-filters";
import { getPaymentReceiptBusinessDayRange } from "@/lib/cashier/cashier-business-day";

export const RECEIPT_ARCHIVE_PAGE_SIZE = 30;

export function receiptArchiveDateRange(value: string | undefined) {
  if (!isValidDateKey(value)) return null;
  // Noon Nairobi time always falls within the selected 7 AM business day.
  return getPaymentReceiptBusinessDayRange(new Date(`${value}T12:00:00+03:00`));
}

export function receiptArchivePage(rawPage: string | undefined, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / RECEIPT_ARCHIVE_PAGE_SIZE));
  const requested = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(requested)
    ? Math.min(Math.max(requested, 1), pageCount)
    : 1;
  return { page, pageCount, skip: (page - 1) * RECEIPT_ARCHIVE_PAGE_SIZE };
}
