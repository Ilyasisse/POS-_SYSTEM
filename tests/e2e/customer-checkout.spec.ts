import { devices, expect, type Page } from "@playwright/test";
import { db, phone, product, sendReceipt, table, user } from "../workflow/fixtures";
import { pickupAction, session, stationAction, test } from "../workflow/browser";

test.afterAll(() => db.$disconnect());

async function placeOrder(
  page: Page,
  item: { name: string },
  payerPhone: string,
  tableId?: string,
) {
  await page.goto("/customer");
  const card = page
    .locator("[data-slot=card]")
    .filter({ has: page.getByRole("heading", { name: item.name, exact: true }) });
  await card.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cart", exact: true })).toBeVisible();
  await page.getByLabel(/Payment phone/).fill(payerPhone);
  if (tableId) {
    await page.getByRole("radio", { name: "Dine in" }).check();
    await page.getByLabel(/Your table/).selectOption(tableId);
  }
  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  await expect(page).toHaveURL(/\/customer\/checkout\//);
  await expect(page.getByRole("heading", { name: "Pay for your order" })).toBeVisible();
}

test("mobile dine-in customer follows a paid order through delivery @core", async ({ browser }) => {
  const [item, diningTable, customer, cook, waiter] = await Promise.all([
    product("FAST_FOOD"),
    table(),
    user("CUSTOMER", { name: "Test Customer" }),
    user("COOK", { station: "FAST_FOOD" }),
    user("WAITER"),
  ]);
  const contexts = await Promise.all([
    session(browser, customer, devices["Pixel 7"]),
    session(browser, cook),
    session(browser, waiter),
  ]);
  try {
    const [customerPage, kitchen, pickup] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    const payerPhone = phone();
    await placeOrder(customerPage, item, payerPhone, diningTable.id);
    expect(await db.order.count({ where: { customerId: customer.id } })).toBe(0);
    expect((await sendReceipt({ phone: payerPhone, amount: Number(item.price) })).ok).toBe(true);
    const progress = customerPage.getByRole("progressbar", { name: "Order progress" });
    await expect(progress).toHaveAttribute("aria-valuetext", "Kitchen received");

    await kitchen.goto("/kitchen/fast-food");
    await stationAction(kitchen, item.name, "Bilow");
    await expect(progress).toHaveAttribute("aria-valuetext", "Being prepared");
    await stationAction(kitchen, item.name, "Dhammaay");
    await expect(progress).toHaveAttribute("aria-valuetext", "Ready for pickup");

    await pickup.goto("/waiter");
    const order = pickup.getByRole("article").filter({ hasText: diningTable.name });
    const persisted = await db.order.findFirstOrThrow({ where: { customerId: customer.id } });
    await pickupAction(
      pickup,
      order.getByRole("button", { name: "Claim", exact: true }),
      persisted.id,
    );
    await expect(progress).toHaveAttribute("aria-valuetext", "Picked up");
    await pickupAction(
      pickup,
      order.getByRole("button", { name: "Delivered", exact: true }),
      persisted.id,
    );
    await expect(progress).toHaveAttribute("aria-valuetext", "Delivered");
    expect(persisted.tableId).toBe(diningTable.id);
    expect(
      (await db.kitchenTicketState.findUniqueOrThrow({ where: { orderId: persisted.id } }))
        .pickupStatus,
    ).toBe("DELIVERED");
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("manager review resumes a mobile takeaway checkout @core", async ({ browser }) => {
  const [item, customer, manager] = await Promise.all([
    product("FAST_FOOD"),
    user("CUSTOMER", { name: "Test Customer" }),
    user("MANAGER"),
  ]);
  const contexts = await Promise.all([
    session(browser, customer, devices["Pixel 7"]),
    session(browser, manager),
  ]);
  try {
    const [customerPage, review] = await Promise.all(contexts.map((context) => context.newPage()));
    const payerPhone = phone();
    await placeOrder(customerPage, item, payerPhone);
    const reference = String(Date.now()).slice(-10);
    expect(
      (
        await sendReceipt({
          phone: payerPhone,
          amount: Number(item.price),
          name: "Other Name",
          reference,
        })
      ).ok,
    ).toBe(true);
    const checkout = await db.customerCheckout.findFirstOrThrow({
      where: { customerId: customer.id },
    });
    expect(checkout.status).toBe("REVIEW");
    await review.goto("/admin/payment-review");
    await review.getByRole("radio", { name: new RegExp(checkout.id) }).check();
    await review.getByRole("radio", { name: new RegExp(reference) }).check();
    await review
      .getByPlaceholder("Explain the evidence used to verify this payment")
      .fill("Verified the synthetic payer details");
    await review.getByRole("checkbox", { name: /I checked the SMS reference/i }).check();
    await review.getByRole("button", { name: /assign.*receipt/i }).click();
    await expect(
      customerPage.getByRole("heading", { name: "Your order", exact: true }),
    ).toBeVisible();
    const paid = await db.customerCheckout.findUniqueOrThrow({ where: { id: checkout.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.orderType).toBe("TAKEOUT");
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
