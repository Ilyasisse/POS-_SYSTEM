import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildSync } from "esbuild";
import FullPageReceipt from "../src/app/print/orders/[id]/entire-page-receipt/FullPageReceipt";
import PrintButton from "../src/app/print/orders/[id]/PrintButton";
import ReceiptActions from "../src/app/print/orders/[id]/ReceiptActions";
import ThermalReceipt from "../src/app/print/orders/[id]/thermal-receipt/ThermalReceipt";
import { thermalReceiptCss } from "../src/app/print/orders/[id]/thermal-receipt/thermal-receipt-styles";
import { buildReceiptData } from "../src/lib/orders/build-receipt-data";
import {
  largeReceiptOrder,
  receiptOrder,
  receiptSettings,
} from "../tests/fixtures/order-receipt";

// Synthetic fixtures use the production components/CSS without accessing a database.
const output = join(process.cwd(), ".next", "receipt-print-check");
mkdirSync(output, { recursive: true });
const cssDirectory = join(process.cwd(), ".next", "static", "chunks");
const css = readdirSync(cssDirectory)
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(join(cssDirectory, name), "utf8"))
  .join("\n");
if (!css)
  throw new Error("Run npm run build before generating receipt fixtures.");

// Hydrate the actual client controls so browser click checks exercise their handlers.
buildSync({
  stdin: {
    contents: `import { createElement } from "react";
      import { hydrateRoot } from "react-dom/client";
      import PrintButton from "./src/app/print/orders/[id]/PrintButton";
      hydrateRoot(document.getElementById("fixture-print-actions"), createElement(PrintButton));
      window.receiptActionsHydrated = true;`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: join(output, "client.js"),
});
const printActions = renderToStaticMarkup(createElement(PrintButton));

for (const [name, format, order] of [
  ["full", "full", receiptOrder()],
  ["thermal", "thermal", receiptOrder()],
  ["large", "thermal", largeReceiptOrder()],
  [
    "oversized",
    "thermal",
    receiptOrder({
      orderItems: [
        {
          productName: "Oversized item",
          qty: 1,
          unitPrice: "15.00",
          lineTotal: "15.00",
          modifiers: Array.from({ length: 180 }, (_, index) => ({
            qty: 1,
            modifierName: `Extra modifier ${index + 1} with instructions`,
          })),
        },
      ],
    }),
  ],
] as const) {
  const receipt = buildReceiptData(order, receiptSettings);
  const html = renderToStaticMarkup(
    createElement(
      "main",
      {
        className:
          format === "thermal"
            ? "thermal-preview"
            : "min-h-dvh bg-muted/30 p-4 text-foreground print:min-h-0 print:bg-white print:p-0",
      },
      createElement(ReceiptActions, { orderId: "fixture", format }),
      format === "thermal"
        ? createElement(ThermalReceipt, { receipt })
        : createElement(FullPageReceipt, { receipt }),
    ),
  )
    .replace(
      printActions,
      `<div id="fixture-print-actions">${printActions}</div>`,
    )
    .replace(/srcSet="[^"]*"/g, "")
    .replace(/src="\/_next\/image[^\"]*"/g, 'src="/newer_logo.png"');
  writeFileSync(
    join(output, `${name}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Receipt print check</title><style>${css}</style>${format === "thermal" ? `<style>${thermalReceiptCss}</style>` : ""}</head><body>${html}<script src="/client.js" defer></script></body></html>`,
  );
}
console.log(`Generated synthetic receipt fixtures in ${output}`);
