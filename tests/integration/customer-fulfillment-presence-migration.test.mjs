import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
const migration = await readFile(new URL("../../prisma/migrations/20260930120000_customer_fulfillment_presence/migration.sql", import.meta.url), "utf8");
test("fulfillment and presence migration preserves legacy takeout and protects tables", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEOUT', 'DELIVERY');
      CREATE TABLE "Staff" ("id" TEXT PRIMARY KEY, "role" TEXT);
      CREATE TABLE "Table" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "CustomerCheckout" ("id" TEXT PRIMARY KEY);
      INSERT INTO "Staff" VALUES ('cashier', 'CASHIER');
      INSERT INTO "Table" VALUES ('table-one');
      INSERT INTO "CustomerCheckout" VALUES ('legacy');
    `);
    await db.exec(migration);
    assert.deepEqual((await db.query('SELECT "orderType", "tableId" FROM "CustomerCheckout"')).rows, [{ orderType: "TAKEOUT", tableId: null }]);
    assert.deepEqual((await db.query('SELECT "availability", "lastSeenAt" FROM "Staff"')).rows, [{ availability: "OFFLINE", lastSeenAt: null }]);
    await db.exec(`UPDATE "CustomerCheckout" SET "orderType" = 'DINE_IN', "tableId" = 'table-one';`);
    await assert.rejects(db.exec(`DELETE FROM "Table" WHERE "id" = 'table-one';`));
    await assert.rejects(db.exec(`UPDATE "Staff" SET "availability" = 'INVALID';`));
    await assert.rejects(db.exec(`UPDATE "CustomerCheckout" SET "tableId" = 'missing';`));
  } finally { await db.close(); }
});
