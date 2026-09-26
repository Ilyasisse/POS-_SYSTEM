import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("register shifts require valid counts and only one open shift per cashier", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Staff" ("id" TEXT PRIMARY KEY)');
    const migration = await readFile(
      new URL(
        "../../prisma/migrations/20260923194500_cashier_register_shift_counts/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(migration);
    await db.query('INSERT INTO "Staff" ("id") VALUES ($1)', ["cashier"]);
    const insert = (id, amount, actor = "cashier") =>
      db.query(
        'INSERT INTO "CashierRegisterShift" ("id", "cashierId", "openingCash") VALUES ($1, $2, $3)',
        [id, actor, amount],
      );
    await insert("first", "10.00");
    await assert.rejects(insert("second", "12.00"));
    await assert.rejects(insert("bad", "-1.00"));
    await assert.rejects(insert("missing", "1.00", "other"));
    await assert.rejects(
      db.query(
        'UPDATE "CashierRegisterShift" SET "closedAt" = now() WHERE "id" = $1',
        ["first"],
      ),
    );
    await db.query(
      'UPDATE "CashierRegisterShift" SET "closedAt" = now(), "closingCash" = $1 WHERE "id" = $2',
      ["14.00", "first"],
    );
    await insert("next", "14.00");
    assert.equal(
      (
        await db.query(
          'SELECT COUNT(*)::int AS count FROM "CashierRegisterShift"',
        )
      ).rows[0].count,
      2,
    );
  } finally {
    await db.close();
  }
});
