import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("floor position migration retains unset tables and rejects invalid coordinates", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE TABLE "Table" ("id" TEXT PRIMARY KEY); INSERT INTO "Table" ("id") VALUES (\'existing\');',
    );
    await db.exec(
      readFileSync(
        new URL(
          "../../prisma/migrations/20260923070000_editable_table_floor_plan/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const old = await db.query(
      'SELECT "floorX", "floorY" FROM "Table" WHERE "id" = \'existing\'',
    );
    assert.deepEqual(old.rows, [{ floorX: null, floorY: null }]);
    await db.exec(
      'UPDATE "Table" SET "floorX" = 42, "floorY" = 58 WHERE "id" = \'existing\'',
    );
    await assert.rejects(
      db.exec('UPDATE "Table" SET "floorX" = 99 WHERE "id" = \'existing\''),
      /Table_floor_position_complete/,
    );
    await assert.rejects(
      db.exec('UPDATE "Table" SET "floorY" = NULL WHERE "id" = \'existing\''),
      /Table_floor_position_complete/,
    );
  } finally {
    await db.close();
  }
});
