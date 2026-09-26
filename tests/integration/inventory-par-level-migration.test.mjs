import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("par migration accepts unset/positive targets and rejects zero", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "InventorySupply" ("id" TEXT PRIMARY KEY);');
    await db.exec(
      readFileSync(
        new URL(
          "../../prisma/migrations/20260923060000_inventory_supply_par_levels/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec('INSERT INTO "InventorySupply" ("id") VALUES (\'unset\');');
    await db.exec(
      'INSERT INTO "InventorySupply" ("id", "parLevel") VALUES (\'set\', 2.125);',
    );
    const records = await db.query(
      'SELECT "parLevel" FROM "InventorySupply" ORDER BY "id"',
    );
    assert.deepEqual(
      records.rows.map((row) => row.parLevel),
      ["2.125000", null],
    );
    await assert.rejects(
      db.exec(
        'INSERT INTO "InventorySupply" ("id", "parLevel") VALUES (\'bad\', 0);',
      ),
      /InventorySupply_parLevel_positive/,
    );
  } finally {
    await db.close();
  }
});
