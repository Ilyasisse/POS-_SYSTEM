import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { parseModifierAllergenInfo } from "../../src/lib/products/modifier-allergen-info";

test("modifier allergen notes are optional and limited to 240 characters", () => {
  assert.equal(parseModifierAllergenInfo(null), null);
  assert.equal(parseModifierAllergenInfo("  Milk  "), "Milk");
  assert.throws(
    () => parseModifierAllergenInfo("x".repeat(241)),
    /240 characters/,
  );
});

test("modifier migration preserves existing options and rejects oversized notes", async () => {
  const database = new PGlite();
  try {
    await database.exec(
      'CREATE TABLE "Modifier" ("id" TEXT PRIMARY KEY); INSERT INTO "Modifier" ("id") VALUES (\'existing\');',
    );
    const migration = readFileSync(
      new URL(
        "../../prisma/migrations/20260926081000_modifier_allergen_notes/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await database.exec(migration);
    const existing = await database.query<{ allergenInfo: string | null }>(
      'SELECT "allergenInfo" FROM "Modifier" WHERE "id" = \'existing\'',
    );
    assert.equal(existing.rows[0]?.allergenInfo, null);
    await assert.rejects(
      database.query(
        'UPDATE "Modifier" SET "allergenInfo" = $1 WHERE "id" = $2',
        ["x".repeat(241), "existing"],
      ),
      /too long/,
    );
  } finally {
    await database.close();
  }
});
