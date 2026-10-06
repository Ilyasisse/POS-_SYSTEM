import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../../prisma/migrations/20260901_product_availability_windows/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("availability windows preserve legacy products and reject incomplete or invalid bounds", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "Product" (
        "id" TEXT PRIMARY KEY,
        "isActive" BOOLEAN NOT NULL DEFAULT true
      );
      INSERT INTO "Product" ("id") VALUES ('legacy');
    `);
    await db.exec(migration);
    assert.deepEqual(
      (await db.query('SELECT "availabilityStartMinute", "availabilityEndMinute" FROM "Product" WHERE "id" = $1', ['legacy'])).rows,
      [{ availabilityStartMinute: null, availabilityEndMinute: null }],
    );
    const insert = 'INSERT INTO "Product" ("id", "availabilityStartMinute", "availabilityEndMinute") VALUES ($1, $2, $3)';
    for (const [id, start, end] of [
      ["missing-start", null, 60],
      ["missing-end", 60, null],
      ["negative", -1, 60],
      ["too-late", 60, 1440],
      ["empty", 60, 60],
    ]) {
      await assert.rejects(db.query(insert, [id, start, end]), /Product_availability_window_check/);
    }
    await db.query(insert, ["daytime", 540, 1020]);
    await db.query(insert, ["overnight", 1320, 120]);
    await db.query(insert, ["unrestricted", null, null]);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM "Product"')).rows[0].count, 4);
  } finally {
    await db.close();
  }
});
