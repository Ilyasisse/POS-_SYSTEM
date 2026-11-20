import { expect } from "@playwright/test";
import { appUrl, db, user } from "../workflow/fixtures";
import { login, test } from "../workflow/browser";

test.afterAll(() => db.$disconnect());

test("cashier signs in, is denied admin access, and signs out @core", async ({ page }) => {
  const cashier = await user("CASHIER");
  await login(page, cashier, "/cashier");
  await expect(page.getByRole("link", { name: /new.*order|dine.in/i }).first()).toBeVisible();
  await page.goto("/admin");
  await expect(page).not.toHaveURL(new URL("/admin", appUrl).href);
  await page.goto("/cashier");
  await page.getByRole("button", { name: new RegExp(cashier.fullName) }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/staff-login/);
  await page.goto("/cashier");
  await expect(page).toHaveURL(/staff-login/);
});
