import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const orderMigration = await readFile(
  new URL("../../prisma/migrations/20260907_customer_delivery_ordering/migration.sql", import.meta.url),
  "utf8",
);
const checkoutMigration = await readFile(
  new URL("../../prisma/migrations/20261004090000_customer_checkout_delivery/migration.sql", import.meta.url),
  "utf8",
);

test("delivery migrations preserve old records and require details on new deliveries", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEOUT', 'DELIVERY');
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "type" "OrderType" NOT NULL);
      CREATE TABLE "CustomerCheckout" (
        "id" TEXT PRIMARY KEY,
        "orderType" "OrderType" NOT NULL DEFAULT 'TAKEOUT',
        "tableId" TEXT,
        "payerPhone" TEXT NOT NULL
      );
      INSERT INTO "Order" VALUES ('old-order', 'DELIVERY');
      INSERT INTO "CustomerCheckout" ("id", "payerPhone") VALUES ('old-checkout', '252901234567');
    `);
    await db.exec(orderMigration);
    await db.exec(checkoutMigration);
    assert.deepEqual((await db.query(`SELECT "deliveryPhone", "deliveryAddress" FROM "CustomerCheckout" WHERE "id" = 'old-checkout'`)).rows,
      [{ deliveryPhone: null, deliveryAddress: null }]);

    await db.exec(`INSERT INTO "CustomerCheckout" ("id", "orderType", "tableId", "payerPhone")
      VALUES ('dine-in', 'DINE_IN', 'table-1', '252901234567'), ('pickup', 'TAKEOUT', NULL, '252901234567');`);
    await assert.rejects(db.exec(`INSERT INTO "CustomerCheckout" ("id", "orderType", "payerPhone")
      VALUES ('missing-details', 'DELIVERY', '252901234567');`));
    for (const [id, address, phone, tableId] of [
      ['blank-address', '     ', '0612345678', null],
      ['short-phone', 'Hodan, near the mosque', '1234', null],
      ['alphabetic-phone', 'Hodan, near the mosque', 'hello', null],
      ['punctuation-phone', 'Hodan, near the mosque', '() --', null],
      ['long-address', 'x'.repeat(501), '0612345678', null],
      ['long-phone', 'Hodan, near the mosque', '1'.repeat(31), null],
      ['delivery-with-table', 'Hodan, near the mosque', '0612345678', 'table-1'],
    ]) {
      await assert.rejects(db.query(`INSERT INTO "CustomerCheckout"
        ("id", "orderType", "payerPhone", "deliveryAddress", "deliveryPhone", "tableId")
        VALUES ($1, 'DELIVERY', '252901234567', $2, $3, $4)`, [id, address, phone, tableId]));
    }
    await db.exec(`INSERT INTO "CustomerCheckout"
      ("id", "orderType", "payerPhone", "deliveryAddress", "deliveryPhone")
      VALUES ('delivery', 'DELIVERY', '252901234567', 'Hodan, near the mosque', '0612345678');`);
    await db.exec(`INSERT INTO "Order" ("id", "type", "deliveryAddress", "deliveryPhone")
      SELECT 'paid-delivery', "orderType", "deliveryAddress", "deliveryPhone" FROM "CustomerCheckout" WHERE "id" = 'delivery';`);
    const result = await db.query(`SELECT "type", "deliveryAddress", "deliveryPhone" FROM "Order" WHERE "id" = 'paid-delivery'`);
    assert.deepEqual(result.rows, [{ type: 'DELIVERY', deliveryAddress: 'Hodan, near the mosque', deliveryPhone: '0612345678' }]);
    await assert.rejects(db.exec(`INSERT INTO "Order" ("id", "type") VALUES ('invalid-order', 'DELIVERY');`));
  } finally {
    await db.close();
  }
});
