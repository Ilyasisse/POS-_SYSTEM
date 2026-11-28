import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  financialTables,
  manifestQuery,
  executionSql,
} from "../../scripts/maintenance/inventory-only-reset.mjs";

async function fixture(requireCatalogTarget = false) {
  const db = new PGlite();
  const columns = {
    InventorySupply: 'name text, "stockQty" numeric, "isActive" boolean',
    InventoryMovement:
      '"supplyId" text REFERENCES "InventorySupply"(id) ON DELETE SET NULL,"itemType" text',
    InventoryUnitConversion: '"supplyId" text REFERENCES "InventorySupply"(id)',
    SupplierCatalogItem:
      '"inventorySupplyId" text REFERENCES "InventorySupply"(id),"productId" text,price numeric',
    StockEvent: '"supplyId" text REFERENCES "InventorySupply"(id)',
    RecipeIngredient: '"supplyId" text REFERENCES "InventorySupply"(id)',
    InventoryCountLine: '"supplyId" text REFERENCES "InventorySupply"(id)',
  };
  for (const table of new Set([
    "InventorySupply",
    "InventoryMovement",
    "InventoryUnitConversion",
    "SupplierCatalogItem",
    ...financialTables,
  ])) {
    await db.exec(
      `CREATE TABLE "${table}" (id text PRIMARY KEY,"cafeteriaId" text NOT NULL DEFAULT 'test-cafe'${columns[table] ? ", " + columns[table] : ", payload text"});`,
    );
  }
  if (requireCatalogTarget) {
    await db.exec(`ALTER TABLE "SupplierCatalogItem" ADD COLUMN IF NOT EXISTS "productId" text;
      ALTER TABLE "SupplierCatalogItem" ADD CONSTRAINT "SupplierCatalogItem_exactly_one_target_check"
      CHECK (("productId" IS NOT NULL)::int + ("inventorySupplyId" IS NOT NULL)::int = 1);`);
  }
  await db.exec(`
    CREATE FUNCTION protect_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable ledger'; END $$;
    CREATE TRIGGER "StockEvent_immutable" BEFORE UPDATE OR DELETE ON "StockEvent" FOR EACH ROW EXECUTE FUNCTION protect_ledger();
    INSERT INTO "InventorySupply"(id,name,"stockQty","isActive") VALUES ('eligible','Disposable item',25,true),('protected','Protected item',8,true);
    INSERT INTO "InventorySupply"(id,"cafeteriaId",name,"stockQty","isActive") VALUES ('other','other-cafe','Other cafeteria',99,true);
    INSERT INTO "StockEvent"(id,"supplyId") VALUES ('ledger','protected');
    INSERT INTO "InventoryMovement"(id,"supplyId","itemType") VALUES ('old-eligible','eligible','Supply'),('old-protected','protected','Supply');
    INSERT INTO "InventoryMovement"(id,"cafeteriaId","supplyId","itemType") VALUES ('other-movement','other-cafe','other','Supply');
    INSERT INTO "InventoryUnitConversion"(id,"supplyId") VALUES ('conversion','eligible');
    INSERT INTO "SupplierCatalogItem"(id,"inventorySupplyId",price) VALUES ('eligible-catalog','eligible',12.50),('protected-catalog','protected',20);
  `);
  for (const table of financialTables.filter((t) => !columns[t]))
    await db.query(`INSERT INTO "${table}" (id,payload) VALUES ($1,$2)`, [
      table + "-preserved",
      "unchanged",
    ]);
  return db;
}
const manifest = async (db) => (await db.query(manifestQuery("test-cafe"))).rows[0].manifest;

test("inventory-only manifest includes all visible movements but excludes ledger-linked items", async () => {
  const db = await fixture();
  try {
    const m = await manifest(db);
    assert.deepEqual(m.counts, {
      InventorySupply: 1,
      InventoryMovement: 2,
      InventoryUnitConversion: 1,
      SupplierCatalogItem: 1,
    });
    assert.equal(m.keptItems, 1);
    assert.equal(m.crossCafeteria, 0);
    assert.equal(m.targets.InventorySupply[0], "eligible");
  } finally {
    await db.close();
  }
});

test("deletes eligible stock and both visible histories, preserves protected stock, catalog prices and every financial record", async () => {
  const db = await fixture();
  try {
    const m = await manifest(db);
    const sql = executionSql(m);
    assert.doesNotMatch(
      sql,
      /DISABLE TRIGGER|ENABLE TRIGGER|ALTER TABLE|DELETE FROM public\."StockEvent"|UPDATE public\."StockEvent"/i,
    );
    await db.exec(sql);
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "InventorySupply" WHERE id='eligible'`)).rows[0]
        .n,
      0,
    );
    assert.equal(
      (
        await db.query(
          `SELECT count(*)::int n FROM "InventoryMovement" WHERE "cafeteriaId"='test-cafe'`,
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query(`SELECT count(*)::int n FROM "InventoryMovement" WHERE id='other-movement'`))
        .rows[0].n,
      1,
    );
    assert.equal(
      (await db.query(`SELECT "stockQty"::text qty FROM "InventorySupply" WHERE id='protected'`))
        .rows[0].qty,
      "8",
    );
    const catalog = (
      await db.query(
        `SELECT "inventorySupplyId",price::text price FROM "SupplierCatalogItem" WHERE id='eligible-catalog'`,
      )
    ).rows[0];
    assert.equal(catalog.inventorySupplyId, null);
    assert.equal(catalog.price, "12.50");
    assert.equal(
      (
        await db.query(
          `SELECT "inventorySupplyId" FROM "SupplierCatalogItem" WHERE id='protected-catalog'`,
        )
      ).rows[0].inventorySupplyId,
      "protected",
    );
    const after = await manifest(db);
    assert.deepEqual(after.protectedHashes, m.protectedHashes);
    await assert.rejects(db.exec(`DELETE FROM "StockEvent" WHERE id='ledger'`), /immutable ledger/);
  } finally {
    await db.close();
  }
});

test("refuses stale manifests, financial drift and new protected references without partial changes", async () => {
  const db = await fixture();
  try {
    const m = await manifest(db);
    await db.exec(`INSERT INTO "StockEvent"(id,"supplyId") VALUES ('new-ledger','eligible')`);
    await assert.rejects(db.exec(executionSql(m)), /Reviewed data changed: StockEvent/);
    await db.exec("ROLLBACK");
    assert.equal(
      (
        await db.query(
          `SELECT "inventorySupplyId" FROM "SupplierCatalogItem" WHERE id='eligible-catalog'`,
        )
      ).rows[0].inventorySupplyId,
      "eligible",
    );
    const m2 = await manifest(db);
    assert.throws(() => executionSql(m2), /No eligible items/);
  } finally {
    await db.close();
  }
});

test("a late failure rolls back item deletion, history deletion and catalog unlinking", async () => {
  const db = await fixture();
  try {
    const m = await manifest(db);
    const sql = executionSql(m).replace(
      "SET CONSTRAINTS ALL IMMEDIATE;",
      "DO $failure$ BEGIN RAISE EXCEPTION 'forced late failure'; END $failure$;",
    );
    await assert.rejects(db.exec(sql), /forced late failure/);
    await db.exec("ROLLBACK");
    assert.deepEqual((await manifest(db)).inputHashes, m.inputHashes);
    assert.deepEqual((await manifest(db)).protectedHashes, m.protectedHashes);
  } finally {
    await db.close();
  }
});

test("refuses the hosted catalog target constraint before preparing a destructive transaction", async () => {
  const db = await fixture(true);
  try {
    const m = await manifest(db);
    assert.equal(m.catalogMustHaveTarget, true);
    assert.throws(() => executionSql(m), /require their current inventory targets/);
    assert.equal(
      (
        await db.query(
          `SELECT count(*)::int n FROM "InventorySupply" WHERE "cafeteriaId"='test-cafe'`,
        )
      ).rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});
