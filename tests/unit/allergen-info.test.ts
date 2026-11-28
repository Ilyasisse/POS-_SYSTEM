import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { parseAllergenInfo } from "../../src/lib/products/allergen-info";

test("catalog allergen notes are optional, trimmed and length-limited", () => {
  assert.equal(parseAllergenInfo(null), null);
  assert.equal(parseAllergenInfo("   "), null);
  assert.equal(parseAllergenInfo("  Contains milk  "), "Contains milk");
  assert.equal(parseAllergenInfo("x".repeat(240)), "x".repeat(240));
  assert.throws(() => parseAllergenInfo("x".repeat(241)), /240 characters/);
});

test("additive migration preserves existing products and limits note length", async () => {
  const database = new PGlite();
  try {
    await database.exec(
      'CREATE TABLE "Product" ("id" TEXT PRIMARY KEY); INSERT INTO "Product" ("id") VALUES (\'existing\');',
    );
    const migration = readFileSync(
      new URL(
        "../../prisma/migrations/20260926080000_product_allergen_notes/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await database.exec(migration);
    const existing = await database.query<{ allergenInfo: string | null }>(
      'SELECT "allergenInfo" FROM "Product" WHERE "id" = \'existing\'',
    );
    assert.equal(existing.rows[0]?.allergenInfo, null);
    await assert.rejects(
      database.query(
        'UPDATE "Product" SET "allergenInfo" = $1 WHERE "id" = $2',
        ["x".repeat(241), "existing"],
      ),
      /too long/,
    );
  } finally {
    await database.close();
  }
});
