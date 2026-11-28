import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../../prisma/migrations/20261124140238_shared_product_modifiers/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const legacySchema = `
  CREATE TABLE "Product" ("id" TEXT PRIMARY KEY);
  CREATE TABLE "ModifierGroup" ("id" TEXT PRIMARY KEY);
  INSERT INTO "ModifierGroup" VALUES ('extras');
  CREATE TABLE "Modifier" (
    "id" TEXT PRIMARY KEY, "productId" TEXT NOT NULL REFERENCES "Product"("id"),
    "name" TEXT NOT NULL, "price" NUMERIC NOT NULL,
    "modifierGroupId" TEXT NOT NULL DEFAULT 'extras' REFERENCES "ModifierGroup"("id")
  );
  CREATE INDEX "Modifier_productId_idx" ON "Modifier"("productId");
  CREATE TABLE "OrderItemModifier" (
    "id" TEXT PRIMARY KEY, "modifierId" TEXT NOT NULL REFERENCES "Modifier"("id"),
    "modifierName" TEXT NOT NULL, "price" NUMERIC NOT NULL
  );
  INSERT INTO "Product" VALUES ('tea'), ('coffee');
`;
const assignments = (db) =>
  db.query(
    'SELECT "B" AS "productId", "A" AS "modifierId" FROM "_ModifierToProduct" ORDER BY "A", "B"',
  );

test("migration preserves every modifier ID, group, assignment and historical snapshot", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      legacySchema +
        `
      INSERT INTO "Modifier" ("id", "productId", "name", "price")
      VALUES ('milk-tea', 'tea', 'Milk', 1), ('milk-coffee', 'coffee', 'Milk', 1);
      INSERT INTO "OrderItemModifier" VALUES ('past-order', 'milk-tea', 'Original milk', 0.5);
    `,
    );
    await db.exec(migration);
    assert.deepEqual((await assignments(db)).rows, [
      { productId: "coffee", modifierId: "milk-coffee" },
      { productId: "tea", modifierId: "milk-tea" },
    ]);
    assert.deepEqual(
      (await db.query('SELECT "id", "modifierGroupId" FROM "Modifier" ORDER BY "id"')).rows,
      [
        { id: "milk-coffee", modifierGroupId: "extras" },
        { id: "milk-tea", modifierGroupId: "extras" },
      ],
    );

    await db.exec(`
      INSERT INTO "_ModifierToProduct" ("A", "B") VALUES ('milk-tea', 'coffee');
      UPDATE "Modifier" SET "price" = 2 WHERE "id" = 'milk-tea';
    `);
    assert.deepEqual(
      (
        await db.query(`
          SELECT link."B" AS "productId", m."price"::float AS price
          FROM "_ModifierToProduct" link JOIN "Modifier" m ON m."id" = link."A"
          WHERE m."id" = 'milk-tea' ORDER BY link."B"
        `)
      ).rows,
      [
        { productId: "coffee", price: 2 },
        { productId: "tea", price: 2 },
      ],
    );
    assert.deepEqual(
      (
        await db.query(
          'SELECT "modifierId", "modifierName", "price"::float AS price FROM "OrderItemModifier"',
        )
      ).rows,
      [{ modifierId: "milk-tea", modifierName: "Original milk", price: 0.5 }],
    );
    await assert.rejects(
      db.exec(`INSERT INTO "_ModifierToProduct" VALUES ('milk-tea', 'coffee')`),
      /duplicate key/,
    );
    await assert.rejects(
      db.exec(`INSERT INTO "_ModifierToProduct" VALUES ('milk-tea', 'missing')`),
      /foreign key/,
    );
    await assert.rejects(
      db.exec(`INSERT INTO "_ModifierToProduct" VALUES ('missing', 'tea')`),
      /foreign key/,
    );
    await assert.rejects(db.exec(`DELETE FROM "Modifier" WHERE "id" = 'milk-tea'`), /foreign key/);

    await db.exec(`DELETE FROM "_ModifierToProduct" WHERE "B" = 'tea' AND "A" = 'milk-tea'`);
    assert.deepEqual((await assignments(db)).rows, [
      { productId: "coffee", modifierId: "milk-coffee" },
      { productId: "coffee", modifierId: "milk-tea" },
    ]);
    assert.equal(
      (await db.query(`SELECT COUNT(*)::int AS count FROM "Modifier" WHERE "id" = 'milk-tea'`))
        .rows[0].count,
      1,
    );
    await db.exec(`DELETE FROM "Modifier" WHERE "id" = 'milk-coffee'`);
    assert.deepEqual((await assignments(db)).rows, [
      { productId: "coffee", modifierId: "milk-tea" },
    ]);
    await db.exec(`DELETE FROM "Product" WHERE "id" = 'coffee'`);
    assert.deepEqual((await assignments(db)).rows, []);
    assert.equal(
      (await db.query('SELECT COUNT(*)::int AS count FROM "Modifier"')).rows[0].count,
      1,
    );
    assert.equal(
      (await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname = '_ModifierToProduct'`))
        .rows[0].relrowsecurity,
      true,
    );
    assert.equal(
      (
        await db.query(
          `SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_name = 'Modifier' AND column_name = 'productId'`,
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (await db.query(`SELECT to_regclass('"ProductModifier"') AS table_name`)).rows[0].table_name,
      null,
    );
  } finally {
    await db.close();
  }
});

test("migration supports an empty catalog", async () => {
  const db = new PGlite();
  try {
    await db.exec(legacySchema);
    await db.exec(migration);
    assert.deepEqual((await assignments(db)).rows, []);
  } finally {
    await db.close();
  }
});

test("migration rolls back if an unexpected dependency prevents removing productId", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      legacySchema +
        `INSERT INTO "Modifier" ("id", "productId", "name", "price") VALUES ('milk', 'tea', 'Milk', 1);
         CREATE VIEW legacy_modifier_products AS SELECT "productId" FROM "Modifier";`,
    );
    await assert.rejects(db.exec(migration), /depend/);
    await db.exec("ROLLBACK");
    assert.equal(
      (await db.query(`SELECT "productId" FROM "Modifier" WHERE "id" = 'milk'`)).rows[0].productId,
      "tea",
    );
    assert.equal(
      (await db.query(`SELECT to_regclass('"_ModifierToProduct"') AS table_name`)).rows[0]
        .table_name,
      null,
    );
  } finally {
    await db.close();
  }
});
