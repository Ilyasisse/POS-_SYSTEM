import {
  THERMAL_PAGE_HEIGHT_MM,
  THERMAL_PAGE_MARGIN_MM,
} from "@/lib/orders/receipt-print-config";

// Kept in the thermal document, rather than global CSS, to isolate @page sizing.
export const thermalReceiptCss = `
.thermal-preview { --background: #fff; --foreground: #171717; --primary: #171717; --primary-foreground: #fff; --muted: #eee; --muted-foreground: #525252; --border: #ccc; min-height: 100dvh; padding: 20px 12px; background: #eee; color: #171717; }
.thermal-receipt { box-sizing: border-box; width: 80mm; max-width: 100%; margin: 0 auto; padding: 4mm; background: #fff; color: #000; box-shadow: 0 2px 12px #0002; font: 11px/1.45 Arial, Helvetica, sans-serif; overflow-wrap: anywhere; }
.thermal-receipt * { box-sizing: border-box; }
.thermal-receipt p, .thermal-receipt h1, .thermal-receipt h2, .thermal-receipt dl, .thermal-receipt dd { margin: 0; }
.thermal-header, .thermal-footer { text-align: center; }
.thermal-logo { display: block; margin: 0 auto 4px; width: 48px; height: 48px; object-fit: contain; filter: grayscale(1) contrast(1.5); }
.thermal-receipt h1 { font-size: 16px; line-height: 1.2; margin-bottom: 4px; }
.thermal-receipt h2 { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
.thermal-status { font-weight: 900; border: 1px solid; margin-top: 5px !important; }
.thermal-section { padding: 8px 0; border-bottom: 1px dashed #000; }
.thermal-header { padding-top: 0; }
.thermal-details > div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); gap: 8px; margin-bottom: 2px; }
.thermal-details dd { text-align: right; }
.thermal-item { margin-bottom: 8px; }
.thermal-item:last-child { margin-bottom: 0; }
.thermal-item-line { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 6px; align-items: start; }
.thermal-item-name { font-weight: 700; }
.thermal-amount { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
.thermal-item-detail { padding-left: 20px; font-size: 10px; }
.thermal-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
.thermal-row > :first-child { min-width: 0; }
.thermal-row > .thermal-amount { flex-shrink: 0; }
.thermal-total { font-size: 15px; font-weight: 800; border-top: 1px solid; padding-top: 4px; margin-top: 4px; }
.thermal-payment { margin-bottom: 5px; }
.thermal-reference { font-size: 10px; }
.thermal-footer { padding-top: 9px; }
@media print {
  @page { size: 80mm ${THERMAL_PAGE_HEIGHT_MM}mm; margin: ${THERMAL_PAGE_MARGIN_MM}mm 0; }
  html, body { width: 80mm; min-width: 0 !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
  .no-print, [aria-label="Notifications"] { display: none !important; }
  .thermal-preview { width: 80mm; min-height: 0; margin: 0; padding: 0; background: #fff; }
  .thermal-receipt { width: 72mm; max-width: none; margin: 0 auto; padding: 0; border: 0; box-shadow: none; overflow: visible; }
  .thermal-item, .thermal-totals, .thermal-payment, .thermal-header, .thermal-details, .thermal-footer, .thermal-note { break-inside: avoid; page-break-inside: avoid; }
  .thermal-receipt .thermal-can-split { break-inside: auto; page-break-inside: auto; }
  .thermal-receipt h2 { break-after: avoid; }
  .thermal-receipt p { orphans: 2; widows: 2; }
}
`;
