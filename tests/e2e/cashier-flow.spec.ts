import { expect, type Page } from "@playwright/test";
import {
  db,
  phone,
  product,
  sendReceipt,
  table,
  user,
  type OrderResponse,
} from "../workflow/fixtures";
import { kitchenCard, pickupAction, session, stationAction, test } from "../workflow/browser";

test.afterAll(() => db.$disconnect());

async function addItem(page: Page, name: string) {
  const search = page.getByPlaceholder("Search coffee, burgers, desserts...");
  await search.fill(name);
  const card = page
    .locator("[data-slot=card]")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await card.getByRole("button", { name: "Add", exact: true }).click();
}

async function submit(page: Page, label: string, path: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" && new URL(candidate.url()).pathname === path,
    ),
    page.getByRole("button", { name: label, exact: true }).click(),
  ]);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as OrderResponse;
}

test("cashier sends rounds to two stations, waiter delivers, and cashier settles the check @core", async ({
  browser,
}) => {
  const [food, drink, extra, diningTable, cashier, cook, drinks, waiter] = await Promise.all([
    product("FAST_FOOD", 5),
    product("CABITAAN", 3),
    product("FAST_FOOD", 2),
    table(),
    user("CASHIER"),
    user("COOK", { station: "FAST_FOOD" }),
    user("Cabitaan", { station: "CABITAAN" }),
    user("WAITER"),
  ]);
  const contexts = await Promise.all(
    [cashier, cook, drinks, waiter].map((account) => session(browser, account)),
  );
  try {
    const [sales, kitchen, beverage, pickup] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    await sales.goto("/cashier/order");
    await sales.getByRole("button", { name: diningTable.name, exact: true }).click();
    await addItem(sales, food.name);
    await addItem(sales, drink.name);
    const first = await submit(sales, "Send to kitchen", "/api/orders/table");

    await Promise.all([
      kitchen.goto("/kitchen/fast-food"),
      beverage.goto("/kitchen/cabitaan"),
      pickup.goto("/waiter"),
    ]);
    const ready = pickup.getByRole("article").filter({ hasText: diningTable.name });
    await stationAction(kitchen, food.name, "Bilow");
    await stationAction(kitchen, food.name, "Dhammaay");
    await expect(ready).toHaveCount(0);
    await stationAction(beverage, drink.name, "Dhammaay");
    await expect(ready).toBeVisible();
    await pickupAction(
      pickup,
      ready.getByRole("button", { name: "Claim", exact: true }),
      first.order.id,
    );
    await expect(ready.getByText(`Claimed by ${waiter.fullName}`)).toBeVisible();
    await pickupAction(
      pickup,
      ready.getByRole("button", { name: "Delivered", exact: true }),
      first.order.id,
    );
    await expect(ready).toHaveCount(0);
    await pickup.reload();
    await expect(pickup.getByRole("heading", { name: "Waiter pickup display" })).toBeVisible();
    expect(
      (await db.kitchenTicketState.findUniqueOrThrow({ where: { orderId: first.order.id } }))
        .pickupStatus,
    ).toBe("DELIVERED");

    await expect(sales).toHaveURL(/\/cashier\?orderStatus=sent/);
    await sales.locator(`a[href="/cashier/order?tableId=${diningTable.id}"]`).click();
    await addItem(sales, extra.name);
    const second = await submit(sales, "Send to kitchen", "/api/orders/table");
    const round = kitchenCard(kitchen, extra.name);
    await expect(round).toContainText("Round 2");
    await expect(round).not.toContainText(food.name);
    const roundRows = await db.order.findMany({
      where: { id: { in: [first.order.id, second.order.id] } },
    });
    expect(new Set(roundRows.map(({ tableCheckId }) => tableCheckId)).size).toBe(1);

    await sales.goto("/cashier");
    const payer = "Test Cashier Payer";
    const payerPhone = phone();
    await sales.getByRole("button", { name: /Take payment.*10\.00/ }).click();
    await sales.getByLabel("Payer 1 payment method").selectOption("GOLIS");
    await sales.getByLabel("Payer 1 name").fill(payer);
    await sales.getByLabel("Payer 1 phone").fill(payerPhone);
    await sales.getByLabel("Payer 1 amount").fill("10");
    await sales.getByRole("button", { name: "Start payment check" }).click();
    const reference = String(Date.now()).slice(-10);
    expect((await sendReceipt({ phone: payerPhone, name: payer, amount: 10, reference })).ok).toBe(
      true,
    );
    await sales.getByLabel("Search receipts").fill(reference);
    await sales.getByRole("button", { name: `Assign to ${payer}`, exact: true }).click();
    await expect
      .poll(() => db.order.count({ where: { tableId: diningTable.id, status: "PAID" } }))
      .toBe(2);

    await sales.goto(`/print/orders/${first.order.id}`);
    await expect(sales.getByRole("button", { name: "Print Receipt" })).toBeVisible();
    await expect(sales.getByText(food.name, { exact: true })).toBeVisible();
    await sales.getByRole("link", { name: "80 mm Thermal Receipt" }).click();
    await expect(sales).toHaveURL(/thermal-receipt$/);
    await expect(sales.getByText(food.name, { exact: true })).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("counter takeaway is paid immediately and queued at the kitchen @core", async ({
  browser,
}) => {
  const [item, cashier, cook] = await Promise.all([
    product("FAST_FOOD"),
    user("CASHIER"),
    user("COOK", { station: "FAST_FOOD" }),
  ]);
  const contexts = await Promise.all([session(browser, cashier), session(browser, cook)]);
  try {
    const [sales, kitchen] = await Promise.all(contexts.map((context) => context.newPage()));
    await sales.goto("/cashier/takeaway");
    await addItem(sales, item.name);
    await sales
      .getByRole("complementary", { name: "Current table order" })
      .getByRole("combobox")
      .selectOption("OTHER");
    const { order } = await submit(sales, "Pay and send to kitchen", "/api/orders");
    await kitchen.goto("/kitchen/fast-food");
    await expect(kitchenCard(kitchen, item.name)).toBeVisible();
    const persisted = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payments: true },
    });
    expect(persisted.type).toBe("TAKEOUT");
    expect(persisted.status).toBe("PAID");
    expect(persisted.payments.map(({ amountPaid }) => Number(amountPaid))).toEqual([5]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
