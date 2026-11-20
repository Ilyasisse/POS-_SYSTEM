import { expect } from "@playwright/test";
import { db, product, unique, user } from "../workflow/fixtures";
import { session, test } from "../workflow/browser";

test.afterAll(() => db.$disconnect());

test("admin availability changes reach the public menu and cashier catalog", async ({
  browser,
  page,
}) => {
  const [item, admin] = await Promise.all([product("FAST_FOOD"), user("ADMIN")]);
  const category = await db.category.findUniqueOrThrow({ where: { id: item.categoryId } });
  const context = await session(browser, admin);
  try {
    const staff = await context.newPage();
    await page.goto("/menu");
    const categoryTab = page.getByRole("button", { name: category.name, exact: true });
    await expect(async () => {
      await categoryTab.click();
      await expect(categoryTab).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
    }).toPass({ timeout: 15_000 });
    await expect(page.getByText(item.name, { exact: true }).first()).toBeVisible();
    await staff.goto("/admin/products");
    const row = staff.getByRole("row").filter({ hasText: item.name });
    await row.getByRole("button", { name: "Mark sold out" }).click();
    const dialog = staff.getByRole("dialog");
    await dialog.getByLabel("Reason").fill("Synthetic delivery delay");
    await dialog.getByRole("button", { name: "Mark sold out" }).click();
    await expect(row.getByRole("button", { name: "Restock" })).toBeVisible();
    await page.reload();
    await expect(categoryTab).toHaveCount(0);
    await expect(page.getByText(item.name, { exact: true })).toHaveCount(0);
    const catalogReady = staff.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/GET/Product/all" && response.ok(),
    );
    await staff.goto("/cashier/takeaway");
    await catalogReady;
    await staff.getByPlaceholder("Search coffee, burgers, desserts...").fill(item.name);
    await expect(staff.getByRole("heading", { name: item.name, exact: true })).toHaveCount(0);
    expect((await db.product.findUniqueOrThrow({ where: { id: item.id } })).availableForSale).toBe(
      false,
    );
  } finally {
    await context.close();
  }
});

test("a supply withdrawal updates quantity and history after reload", async ({ browser }) => {
  const [staff, supply] = await Promise.all([
    user("Cabitaan", { station: "CABITAAN" }),
    db.inventorySupply.create({
      data: {
        name: unique("Test supply"),
        unit: "g",
        canonicalUnit: "GRAM",
        quantityCoverage: "COMPLETE",
        stockQty: 1000,
      },
    }),
  ]);
  const context = await session(browser, staff);
  try {
    const page = await context.newPage();
    await page.goto("/inventory");
    const article = page.getByRole("article").filter({ hasText: supply.name });
    await article.getByLabel("Quantity").fill("125");
    await article.getByLabel("Note").fill("Test prep withdrawal");
    await article.getByRole("button", { name: "Take out" }).click();
    await expect
      .poll(async () =>
        Number((await db.inventorySupply.findUniqueOrThrow({ where: { id: supply.id } })).stockQty),
      )
      .toBe(875);
    await page.reload();
    await expect(article).toContainText("875");
    await expect(page.getByText("Test prep withdrawal", { exact: true })).toBeVisible();
    expect(
      await db.stockEvent.count({ where: { supplyId: supply.id, actorUserId: staff.id } }),
    ).toBe(1);
  } finally {
    await context.close();
  }
});
