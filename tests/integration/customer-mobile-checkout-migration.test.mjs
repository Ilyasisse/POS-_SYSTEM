import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../../prisma/migrations/20260918090000_customer_mobile_checkout/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("customer checkout migration preserves unique receipt claims and cashier-independent payments", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "Customer" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "Order" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "MobileMoneyReceipt" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "Payment" ("id" TEXT PRIMARY KEY, "cashierId" TEXT NOT NULL);
      INSERT INTO "Customer" VALUES ('customer-1');
      INSERT INTO "MobileMoneyReceipt" VALUES ('receipt-1');
      INSERT INTO "Order" VALUES ('order-1');
    `);
    await db.exec(migration);
    await db.query(
      `INSERT INTO "CustomerCheckout"
       ("id", "customerId", "customerName", "payerPhone", "amount", "snapshot", "idempotencyKey", "updatedAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
      [
        "checkout-1",
        "customer-1",
        "Customer",
        "252905109687",
        26,
        "[]",
        "key-1",
      ],
    );
    await assert.rejects(
      db.query(
        `INSERT INTO "CustomerCheckout"
         ("id", "customerId", "customerName", "payerPhone", "amount", "snapshot", "idempotencyKey", "updatedAt", "expiresAt")
         VALUES ('checkout-2', 'customer-1', 'Customer', '252905109687', 26, '[]', 'key-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
      ),
    );
    await db.query(
      `UPDATE "CustomerCheckout" SET "receiptId" = 'receipt-1', "orderId" = 'order-1' WHERE "id" = 'checkout-1'`,
    );
    await db.query(
      `INSERT INTO "Payment" ("id", "cashierId") VALUES ('payment-1', NULL)`,
    );
    const result = await db.query(
      `SELECT "receiptId", "orderId" FROM "CustomerCheckout" WHERE "id" = 'checkout-1'`,
    );
    assert.deepEqual(result.rows, [
      { receiptId: "receipt-1", orderId: "order-1" },
    ]);
  } finally {
    await db.close();
  }
});
