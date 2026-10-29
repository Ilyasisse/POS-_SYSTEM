# Order receipts in Chrome on Windows

Open an existing receipt from **Cashier → Customer receipts → Print**.

1. Select **80 mm Thermal Receipt** to see a narrow preview. **Full Page Receipt** keeps the existing layout and remains the default for existing links.
2. Click **Save as PDF**. This opens Chrome's print dialog.
3. Set **Destination → Save as PDF**, keep the page size supplied by the receipt, and save. No thermal printer is needed.
4. **Print Receipt** opens the same dialog so you can choose a connected printer instead.

Thermal PDFs use 80 × 200 mm pages with about 72 mm of content. Long orders continue on additional pages; the final page can have trailing whitespace. Browser or printer overrides can change paper size, margins, and scale. Use 100% scale and disable headers/footers if your browser or printer overrides the receipt defaults. Physical printers still need a compatible 80 mm paper configuration.

Both routes use the existing receipt access checks and stored sale amounts. Café currency/timezone settings apply to both formats. Thermal receipts omit customer identity and contact information. There is no direct-download PDF endpoint, database migration, or new application dependency.

## Local verification

Run the focused tests with `node --import tsx --test tests/unit/order-receipt.test.ts tests/unit/receipt-access.test.ts`.

After `npm run build`, generate synthetic receipts with `node --import tsx scripts/generate-order-receipt-fixtures.ts`. This renders the actual components with the built CSS into ignored `.next/receipt-print-check/` files without connecting to the database.

Run `node tests/browser/order-receipt-print.mjs` with Playwright and `pdfjs-dist` available on `NODE_PATH` (the Codex bundled browser tooling supplies both). Set `CHROME_PATH` if needed. The script tests desktop/mobile layouts, both hydrated print buttons, document navigation, hidden controls, short/large/oversized-item PDFs, page dimensions, and complete text. It saves preview screenshots and synthetic PDFs in the same ignored folder. Browser fixture checks do not establish live authenticated receipt access; that is covered separately by mocked route/loader tests and existing authorization tests.
