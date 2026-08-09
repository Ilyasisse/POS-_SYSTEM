export function formatSupplierInvoiceNumber(invoiceNumber: number) {
  return `INV-${String(invoiceNumber).padStart(6, "0")}`;
}
