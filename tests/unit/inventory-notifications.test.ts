import assert from "node:assert/strict";
import Module from "node:module";
import test, { type TestContext } from "node:test";
import { Prisma } from "@prisma/client";

type Mail = { html: string };
const messages: Mail[] = [];
let outcome: "success" | "error" | "throw" = "success";
const supplies = [
  {
    id: "sugar",
    name: "Sugar",
    unit: "kg",
    canonicalUnit: "GRAM",
    stockQty: new Prisma.Decimal(1000),
    lowStockThreshold: new Prisma.Decimal(2000),
    inventoryAlertStatus: "LOW",
  },
  {
    id: "milk",
    name: "Milk",
    unit: "l",
    canonicalUnit: "MILLILITRE",
    stockQty: new Prisma.Decimal(2500),
    lowStockThreshold: new Prisma.Decimal(3000),
    inventoryAlertStatus: "LOW",
  },
];
const moduleLoader = Module as unknown as {
  _load: (id: string, ...args: unknown[]) => unknown;
};
const originalLoad = moduleLoader._load;
moduleLoader._load = function (id, ...args) {
  if (id === "server-only") return {};
  if (id === "@/lib/prisma")
    return { prisma: { inventorySupply: { findMany: async () => supplies } } };
  if (id === "resend") {
    return {
      Resend: class {
        emails = {
          send: async (mail: Mail) => {
            messages.push(mail);
            if (outcome === "throw") throw new Error("Network unavailable");
            return {
              error: outcome === "error" ? { message: "Email rejected" } : null,
            };
          },
        };
      },
    };
  }
  return originalLoad.call(this, id, ...args);
};
const inventory = import("../../src/lib/inventory/inventory").finally(() => {
  moduleLoader._load = originalLoad;
});

function configureEmail(t: TestContext) {
  const keys = [
    "RESEND_API_KEY",
    "INVENTORY_ALERT_EMAIL_FROM",
    "INVENTORY_ALERT_EMAIL_TO",
  ];
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key) => {
    process.env[key] = "test-value";
  });
  t.after(() =>
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }),
  );
  messages.length = 0;
  outcome = "success";
}

test("immediate alerts render product and supply names as escaped text", async (t) => {
  configureEmail(t);
  const { sendInventoryAlerts } = await inventory;
  const result = await sendInventoryAlerts([
    {
      itemName: 'Tea & <img src="tracking">',
      itemType: "Supply",
      status: "LOW",
      stockQty: 1,
      lowStockThreshold: 2,
    },
  ]);
  assert.equal(result.sent, 1);
  assert.match(
    messages[0].html,
    /Tea &amp; &lt;img src=&quot;tracking&quot;&gt;/,
  );
  assert.equal(messages[0].html.includes('<img src="tracking">'), false);
});

test("daily digests label canonical stock quantities with canonical units", async (t) => {
  configureEmail(t);
  const { sendDailyInventorySupplyDigest } = await inventory;
  const result = await sendDailyInventorySupplyDigest();
  assert.equal(result.sent, true);
  assert.match(messages[0].html, /1000 g/);
  assert.match(messages[0].html, /2500 ml/);
  assert.equal(messages[0].html.includes("1000 kg"), false);
  assert.equal(messages[0].html.includes("2500 l"), false);
});

for (const failure of ["error", "throw"] as const) {
  test(`daily digest reports ${failure} delivery failure without failing the inventory refresh`, async (t) => {
    configureEmail(t);
    outcome = failure;
    t.mock.method(console, "error", () => undefined);
    const { sendDailyInventorySupplyDigest } = await inventory;
    const result = await sendDailyInventorySupplyDigest();
    assert.equal(result.sent, false);
    assert.equal(result.reason, "email_delivery_failed");
    assert.equal(result.lowStockCount, 2);
    assert.equal(result.outOfStockCount, 0);
  });
}
