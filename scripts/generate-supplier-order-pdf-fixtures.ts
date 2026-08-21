import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generatePurchaseOrderPdf } from "../src/lib/supplier-orders/purchase-order-pdf";

const outputDirectory = path.resolve(process.argv[2] ?? "tmp/pdfs");
const base = {
  orderNumber: 101,
  status: "OPEN",
  supplierName: "Jasper Market Supplies",
  supplierContact: "Jessica Laverdetman",
  supplierPhone: "+252 61 234 5678",
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  expectedDeliveryDate: new Date("2026-08-11T00:00:00.000Z"),
  preparedBy: "Mash Allah Cafe Admin",
  notes: "Deliver to the rear entrance between 8:00 AM and 10:00 AM.",
  totalAmount: "1045.50",
};
const item = (index: number) => ({
  name: `Premium roasted coffee beans - selection ${index + 1}`,
  unit: index % 2 ? "12 kg carton" : "bag",
  quantity: `${index + 1}.5`,
  unitPrice: "20.50",
  lineTotal: `${(index + 1.5) * 20.5}`,
});

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, "supplier-order-one-page.pdf"),
      await generatePurchaseOrderPdf({
        ...base,
        items: [item(0), item(1), item(2)],
      }),
    ),
    writeFile(
      path.join(outputDirectory, "supplier-order-multi-page.pdf"),
      await generatePurchaseOrderPdf({
        ...base,
        orderNumber: 102,
        items: Array.from({ length: 45 }, (_, index) => item(index)),
      }),
    ),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
