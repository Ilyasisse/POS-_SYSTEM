export const SUPPLIER_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

const SUPPLIER_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeSupplierSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidSupplierSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function safeInternalReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function validateSupplierReceipt(file: File) {
  if (!SUPPLIER_RECEIPT_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Upload a JPEG, PNG, or WebP image. HEIC and HEIF are not supported.");
  }

  if (file.size <= 0 || file.size > SUPPLIER_RECEIPT_MAX_BYTES) {
    throw new Error("Receipt images must be between 1 byte and 10 MB.");
  }
}

export function receiptExtension(contentType: string) {
  const type = contentType.toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}
