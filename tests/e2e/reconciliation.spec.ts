import { expect } from "@playwright/test";
import { db, product, user } from "../workflow/fixtures";
import { session, test } from "../workflow/browser";

test.afterAll(() => db.$disconnect());

test("admin closes a waiter day and reconciles Daily Cash and the daily sales report", async ({
  browser,
}) => {
  const [admin, waiter, item] = await Promise.all([user("ADMIN"), user("WAITER"), product()]);
  const settlementDay = "2026-10-12";
  const cashDay = "2026-10-13";
  await db.waiterBalanceInitialization.create({
    data: {
      waiterId: waiter.id,
      openingBalance: 0,
      effectiveBusinessDate: new Date(settlementDay),
      createdByUserId: admin.id,
    },
  });
  await db.dailySalaryRate.create({
    data: { effectiveBusinessDate: new Date(cashDay), amount: 5, createdByUserId: admin.id },
  });
  const closedAt = new Date(`${settlementDay}T08:00:00Z`);
  await db.order.create({
    data: {
      type: "TAKEOUT",
      status: "PAID",
      total: 30,
      createdAt: closedAt,
      closedAt,
      waiterId: waiter.id,
      orderItems: {
        create: {
          productId: item.id,
          productName: item.name,
          qty: 1,
          unitPrice: 30,
          lineTotal: 30,
        },
      },
    },
  });
  const context = await session(browser, admin);
  try {
    const page = await context.newPage();
    await page.goto(`/admin/waiter-balances?date=${settlementDay}`);
    const row = page.getByRole("row").filter({ hasText: waiter.fullName });
    await row.locator("input[name=reportedSales]").fill("30");
    await row.locator("input[name=endDayAmount]").fill("24");
    await row.getByRole("button", { name: "Close day" }).click();
    await expect(row.getByText("Closed", { exact: true })).toBeVisible();
    await page.goto(`/admin/daily-cash?date=${cashDay}`);
    const revenue = page.getByText("Waiter revenue", { exact: true }).locator("..");
    await expect(revenue).toContainText("$24.00");

    await page.goto(`/admin/reports/daily?businessDate=${settlementDay}`);
    const sales = page.getByText("Net Sales", { exact: true }).locator("..");
    await expect(sales).toContainText("$30.00");
    const csv = await context.request.post(
      `/api/admin/reports/export?report=sales&format=csv&businessDate=${settlementDay}`,
    );
    expect(csv.ok()).toBe(true);
    expect(await csv.text()).toMatch(/30\.00/);
  } finally {
    await context.close();
  }
});
