import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("cash drawer migration enforces positive amounts, staff links and retry uniqueness", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Staff" ("id" TEXT PRIMARY KEY)');
    const sql = await readFile(
      new URL(
        "../../prisma/migrations/20260923193000_cash_drawer_movements/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql);
    await db.query('INSERT INTO "Staff" ("id") VALUES ($1)', ["manager"]);
    await db.query(
      'INSERT INTO "CashDrawerMovement" ("id", "idempotencyKey", "direction", "amount", "reason", "recordedById") VALUES ($1, $2, $3, $4, $5, $6)',
      ["first", "retry", "IN", "2.50", "Added change", "manager"],
    );
    for (const [id, retry, amount, reason, actor] of [
      ["second", "retry", "2.50", "Repeated request", "manager"],
      ["third", "fresh", "-1.00", "Bad amount", "manager"],
      ["fourth", "fresh2", "1.00", "  ", "manager"],
      ["fifth", "fresh3", "1.00", "No staff", "missing"],
    ]) {
      await assert.rejects(
        db.query(
          'INSERT INTO "CashDrawerMovement" ("id", "idempotencyKey", "direction", "amount", "reason", "recordedById") VALUES ($1, $2, $3, $4, $5, $6)',
          [id, retry, "OUT", amount, reason, actor],
        ),
      );
    }
    assert.equal(
      (
        await db.query(
          'SELECT COUNT(*)::int AS count FROM "CashDrawerMovement"',
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await db.close();
  }
});
