import { expect } from "@playwright/test";
import { db } from "../workflow/fixtures";
import { supplierCatalog, supplierRequest } from "../workflow/supplier-fixture";
import { session, test } from "../workflow/browser";

test.afterAll(() => db.$disconnect());

test("purchase order becomes an invoice, received stock and a partially paid bill", async ({
  browser,
}) => {
  const { item, admin, supplier, catalog } = await supplierCatalog();
  const context = await session(browser, admin);
  try {
    const page = await context.newPage();
    await page.goto("/admin/supplier-purchase-orders/new");
    await page.getByLabel("Supplier", { exact: true }).selectOption(supplier.id);
    await page.locator("select[name=catalogItemId]").selectOption(catalog.id);
    await page.locator("input[name=quantity]").fill("3");
    await page.getByRole("button", { name: "Create purchase order" }).click();
    await expect(page).toHaveURL(/supplier-purchase-orders\/[^/?]+\?orderStatus=created/);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /mark completed.*create invoice/i }).click();
    await expect(page).toHaveURL(/supplier-invoices\/[^/?]+/);
    const invoice = await db.supplierInvoice.findFirstOrThrow({
      where: { supplierId: supplier.id },
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Finalize invoice", exact: true }).click();
    await expect.poll(() => db.supplierBill.count({ where: { invoiceId: invoice.id } })).toBe(1);
    const bill = await db.supplierBill.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
    await page.goto("/admin/supplier-bills");
    const form = page
      .locator("form")
      .filter({ has: page.locator(`input[name=billId][value="${bill.id}"]`) })
      .filter({ has: page.getByRole("button", { name: "Record payment" }) });
    await form.getByLabel("Payment amount").fill("5");
    await form.getByLabel("Payment method").selectOption("Cash");
    await form.getByRole("button", { name: "Record payment" }).click();
    await expect
      .poll(async () =>
        Number((await db.supplierBill.findUniqueOrThrow({ where: { id: bill.id } })).paidAmount),
      )
      .toBe(5);
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: item.id } })).stockQty)).toBe(
      23,
    );
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: supplier.name })).toContainText("$7.00");
  } finally {
    await context.close();
  }
});

test("employee quantities are confirmed and counted in schedule history", async ({
  browser,
  page,
}) => {
  const { token, item, admin, schedule, recipient } = await supplierRequest();
  await page.goto(`/supplier-order/request/${token}`);
  await page.getByLabel(`${item.name} quantity`).fill("2.5");
  await page.getByRole("button", { name: "Confirm selected items" }).click();
  await expect(page.getByText("Your order choices are confirmed.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(`${item.name} quantity`)).toHaveValue("2.5");
  const context = await session(browser, admin);
  try {
    const management = await context.newPage();
    await management.goto(`/admin/supplier-order-schedules/${schedule.id}`);
    await expect(management.getByText("1 ordered · 0 no order")).toBeVisible();
    const persisted = await db.supplierOrderResponseItem.findFirstOrThrow({
      where: { recipientId: recipient.id },
    });
    expect(Number(persisted.quantity)).toBe(2.5);
  } finally {
    await context.close();
  }
});
