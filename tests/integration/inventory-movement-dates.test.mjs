import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { Prisma, InventoryAlertStatus } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";

// Run the real actions and ledger with a small Prisma adapter backed by Postgres.
function load(path, dependencies = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    exports,
    Date,
    process,
    console: { error() {} },
    require(name) {
      if (name === "server-only") return {};
      if (!(name in dependencies)) throw new Error(`Missing test dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
const client = { Prisma, InventoryAlertStatus };
const domain = load("src/lib/inventory/inventory-domain.ts", { "@prisma/client": client });
const units = load("src/lib/inventory/supply-units.ts", {
  "@prisma/client": client,
  "./inventory-domain": domain,
});
const dates = load("src/lib/inventory/movement-date.ts", {
  "@/lib/supplies/supply-purchases": load("src/lib/supplies/supply-purchases.ts", {
    "@prisma/client": client,
  }),
});
const context = load("src/lib/inventory/cafeteria-context.ts");
const migration = readFileSync(
  "prisma/migrations/20261118054712_inventory_movement_dates/migration.sql",
  "utf8",
);
const value = (v) =>
  v instanceof Prisma.Decimal ? v.toString() : v instanceof Date ? v.toISOString() : v;

async function fixture({ omitContext = false, failMovement = false, actorId = "staff" } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "Staff" (id text PRIMARY KEY, "cafeteriaId" text NOT NULL);
    CREATE TABLE "InventorySupply" (
      id text PRIMARY KEY, name text, unit text, "stockQty" numeric(18,6), "lowStockThreshold" numeric(18,6),
      "isActive" boolean DEFAULT true, "canonicalUnit" text, "quantityCoverage" text, "standardUnitCost" numeric,
      "inventoryAlertStatus" text,
      "cafeteriaId" text NOT NULL DEFAULT current_setting('app.cafeteria_id', true),
      "updatedAt" timestamp DEFAULT now(), UNIQUE (name, unit));
    CREATE TABLE "StockEvent" (
      id text PRIMARY KEY, "supplyId" text, "productId" text, type text, "quantityDelta" numeric,
      "quantityBefore" numeric, "quantityAfter" numeric, "canonicalUnit" text, "standardUnitCostSnapshot" numeric,
      "dataCoverage" text, reason text, "actorUserId" text, "actorCustomerId" text, "approvedByUserId" text,
      "sourceType" text, "sourceId" text, "occurredAt" timestamp DEFAULT now(), "createdAt" timestamp DEFAULT now(),
      "cafeteriaId" text NOT NULL DEFAULT nullif(current_setting('app.cafeteria_id', true), ''),
      CHECK ("quantityAfter" = "quantityBefore" + "quantityDelta"));
    CREATE TABLE "InventoryMovement" (
      id text PRIMARY KEY, "supplyId" text, "itemName" text, "itemType" text, delta numeric,
      "quantityBefore" numeric, "quantityAfter" numeric, "canonicalUnit" text, "dataCoverage" text,
      "standardUnitCostSnapshot" numeric, reason text, note text, "createdAt" timestamp DEFAULT now(),
      "cafeteriaId" text NOT NULL DEFAULT nullif(current_setting('app.cafeteria_id', true), ''));
    CREATE TABLE "AuditLog" (id text PRIMARY KEY, "actorUserId" text, action text, "entityType" text,
      "entityId" text, reason text, "previousValue" jsonb, "newValue" jsonb,
      "cafeteriaId" text NOT NULL DEFAULT nullif(current_setting('app.cafeteria_id', true), ''));
    INSERT INTO "Staff" VALUES ('staff', 'cafe-a'), ('other-staff', 'cafe-b');
    INSERT INTO "InventorySupply" VALUES
      ('flour', 'Flour', 'kg', 3000, 1000, true, 'GRAM', 'COMPLETE', 0.01, 'OK', 'cafe-a', now()),
      ('other', 'Other flour', 'kg', 3000, 1000, true, 'GRAM', 'COMPLETE', 0.01, 'OK', 'cafe-b', now());
    INSERT INTO "InventoryMovement" (id, "cafeteriaId", "createdAt") VALUES ('legacy', 'cafe-a', '2026-01-01');
  `);
  await db.exec(migration);
  await db.exec(migration); // Backfill must be safe to rerun.
  let seq = 0;
  function adapter(conn) {
    const insert =
      (table) =>
      async ({ data }) => {
        if (failMovement && table === "InventoryMovement")
          throw new Error("forced history failure");
        const row = { id: `row-${++seq}`, ...data };
        const keys = Object.keys(row);
        try {
          await conn.query(
            `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
            Object.values(row).map(value),
          );
        } catch (error) {
          // Match the Prisma adapter's translation of PostgreSQL unique violations.
          if (error.code === "23505")
            throw new Prisma.PrismaClientKnownRequestError("Unique constraint violation", {
              code: "P2002",
              clientVersion: Prisma.prismaVersion.client,
            });
          throw error;
        }
        return row;
      };
    const find = async ({ where }) => {
      const row = (await conn.query('SELECT * FROM "InventorySupply" WHERE id = $1', [where.id]))
        .rows[0];
      if (!row) return null;
      for (const k of ["stockQty", "lowStockThreshold", "standardUnitCost"])
        if (row[k] != null) row[k] = new Prisma.Decimal(row[k]);
      row.updatedAt = new Date(row.updatedAt);
      return row;
    };
    const update = async ({ where, data }) => {
      const keys = Object.keys(data);
      const values = keys.map((k) => value(data[k]?.increment ?? data[k]));
      const assignments = keys.map(
        (k, i) => `"${k}" = ${data[k]?.increment !== undefined ? `"${k}" + ` : ""}$${i + 1}`,
      );
      const conditions = [`id = $${values.push(where.id)}`];
      if (where.stockQty?.gte !== undefined)
        conditions.push(`"stockQty" >= $${values.push(value(where.stockQty.gte))}`);
      const result = await conn.query(
        `UPDATE "InventorySupply" SET ${assignments.join(",")} WHERE ${conditions.join(" AND ")} RETURNING id`,
        values,
      );
      return { count: result.rows.length };
    };
    return {
      $queryRaw: async (strings, ...params) =>
        (
          await conn.query(
            strings.reduce((sql, part, i) => sql + (i ? `$${i}` : "") + part, ""),
            params.map(value),
          )
        ).rows,
      inventorySupply: {
        create: insert("InventorySupply"),
        findUnique: find,
        findUniqueOrThrow: find,
        update,
        updateMany: update,
      },
      stockEvent: { create: insert("StockEvent") },
      inventoryMovement: { create: insert("InventoryMovement") },
      auditLog: { create: insert("AuditLog") },
    };
  }
  const prisma = {
    ...adapter(db),
    $transaction: (fn) => db.transaction((conn) => fn(adapter(conn))),
  };
  const refreshedPaths = [];
  const ledger = load("src/lib/inventory/stock-ledger.ts", {
    "@prisma/client": client,
    "@/lib/prisma": { prisma },
    "@/lib/inventory/inventory-domain": domain,
  });
  const inventory = load("src/lib/inventory/inventory.ts", {
    "@prisma/client": client,
    resend: {},
    "@/lib/prisma": { prisma },
    "@/lib/inventory/inventory-domain": domain,
    "@/lib/inventory/stock-ledger": ledger,
  });
  const dependencies = {
    "@prisma/client": client,
    "@/lib/prisma": { prisma },
    "next/cache": { revalidatePath(path) { refreshedPaths.push(path); } },
    "@/lib/auth/permissions": { PERMISSIONS: { INVENTORY_MANAGE: "manage" } },
    "@/lib/auth/require-permission": {
      requirePermission: async () => ({ id: actorId, role: "ADMIN" }),
    },
    "@/lib/inventory/inventory": {
      ...inventory,
      sendInventoryAlerts: async () => ({ attempted: 0 }),
    },
    "@/lib/inventory/supply-units": units,
    "@/lib/inventory/inventory-domain": domain,
    "@/lib/inventory/movement-date": dates,
    "@/lib/inventory/cafeteria-context": omitContext
      ? {
          ...context,
          configureInventoryCafeteria: async () => {},
          configureSupplyCreationCafeteria: async () => {},
        }
      : context,
    "@/lib/posthog-server": { getPostHogClient: () => null },
  };
  return {
    db,
    refreshedPaths,
    setActor(id) { actorId = id; },
    ...load("src/app/inventory/actions.ts", dependencies),
    ...load("src/app/admin/(operations)/inventory/actions.ts", dependencies),
  };
}
function form(overrides = {}) {
  const data = new FormData();
  for (const [key, v] of Object.entries({
    supplyId: "flour",
    stockUnit: units.supplyStockUnit({ unit: "kg", canonicalUnit: "GRAM" }).token,
    quantity: "0.5",
    movementDate: "2026-01-02",
    ...overrides,
  }))
    data.set(key, v);
  return data;
}
async function balances(db) {
  return (
    await db.query(`SELECT "stockQty"::text AS stock, (SELECT count(*)::int FROM "StockEvent") AS events,
    (SELECT count(*)::int FROM "InventoryMovement" WHERE id <> 'legacy') AS movements FROM "InventorySupply" WHERE id='flour'`)
  ).rows[0];
}

test("reproduces the reported missing cafeteria error and rolls back the deduction", async () => {
  const f = await fixture({ omitContext: true });
  try {
    assert.equal((await f.takeSupplyInventory(form())).ok, false);
    assert.deepEqual(await balances(f.db), { stock: "3000.000000", events: 0, movements: 0 });
  } finally {
    await f.db.close();
  }
});

test("withdrawal records the right cafeteria and past date in both histories", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.takeSupplyInventory(form())).ok, true);
    assert.deepEqual(await balances(f.db), { stock: "2500.000000", events: 1, movements: 1 });
    const rows = (
      await f.db.query(`SELECT "cafeteriaId", "occurredAt"::text AS date FROM "StockEvent"
      UNION ALL SELECT "cafeteriaId", "occurredAt"::text FROM "InventoryMovement" WHERE id <> 'legacy'`)
    ).rows;
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.cafeteriaId, "cafe-a");
      assert.equal(row.date, "2026-01-02 09:00:00");
    }
    assert.equal(
      (
        await f.db.query(
          `SELECT "occurredAt" = "createdAt" AS preserved FROM "InventoryMovement" WHERE id='legacy'`,
        )
      ).rows[0].preserved,
      true,
    );
    assert.ok(
      !(await f.db.query(`SELECT current_setting('app.cafeteria_id', true) AS setting`)).rows[0]
        .setting,
    );
  } finally {
    await f.db.close();
  }
});

test("restock and metadata edits inherit cafeteria; a stock correction stays current", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.adjustSupplyInventory(form({ quantity: "1.25" }))).ok, true);
    assert.equal((await balances(f.db)).stock, "4250.000000");
    const version = new Date(
      (await f.db.query(`SELECT "updatedAt" FROM "InventorySupply" WHERE id='flour'`)).rows[0]
        .updatedAt,
    ).toISOString();
    assert.equal(
      (
        await f.editSupply(
          form({
            name: "Wheat flour",
            unit: "g",
            stockQty: "4250",
            lowStockThreshold: "1000",
            version,
          }),
        )
      ).ok,
      true,
    );
    assert.equal(
      (await f.db.query(`SELECT "cafeteriaId" FROM "AuditLog"`)).rows[0].cafeteriaId,
      "cafe-a",
    );
    assert.equal(
      (
        await f.updateSupplyInventory(
          form({
            stockUnit: units.supplyStockUnit({ unit: "g", canonicalUnit: "GRAM" }).token,
            stockQty: "4000",
            lowStockThreshold: "1000",
          }),
        )
      ).ok,
      true,
    );
    const latest = (
      await f.db.query(`SELECT "occurredAt" FROM "StockEvent" ORDER BY "createdAt" DESC LIMIT 1`)
    ).rows[0];
    assert.ok(new Date(latest.occurredAt).getTime() > Date.now() - 60000);
  } finally {
    await f.db.close();
  }
});

test("invalid inputs and cross-cafeteria requests leave stock and histories unchanged", async () => {
  const f = await fixture();
  try {
    for (const input of [
      { quantity: "4" },
      { quantity: "-1" },
      { movementDate: "2099-01-01" },
      { movementDate: "2026-02-30" },
      { stockUnit: "stale" },
      { supplyId: "other" },
    ]) {
      assert.equal((await f.takeSupplyInventory(form(input))).ok, false);
      assert.deepEqual(await balances(f.db), { stock: "3000.000000", events: 0, movements: 0 });
    }
  } finally {
    await f.db.close();
  }
});

test("a history failure rolls back the stock event and balance together", async () => {
  const f = await fixture({ failMovement: true });
  try {
    assert.equal((await f.takeSupplyInventory(form())).ok, false);
    assert.deepEqual(await balances(f.db), { stock: "3000.000000", events: 0, movements: 0 });
  } finally {
    await f.db.close();
  }
});

test("date-only entries use Nairobi noon; today and older clients retain the actual time", () => {
  const now = new Date("2026-11-18T22:00:00Z");
  assert.equal(dates.inventoryMovementDate(null, now).toISOString(), now.toISOString());
  assert.equal(dates.inventoryMovementDate("2026-11-19", now).toISOString(), now.toISOString());
  assert.equal(
    dates.inventoryMovementDate("2026-11-18", now).toISOString(),
    "2026-11-18T09:00:00.000Z",
  );
  const range = dates.inventoryDateRange("2026-11-18");
  assert.equal(range.gte.toISOString(), "2026-11-17T21:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-11-18T21:00:00.000Z");
  for (const date of ["", "2026-02-29", "2026-11-20"])
    assert.throws(() => dates.inventoryMovementDate(date, now), /valid inventory date/);
});

function newSupplyForm(overrides = {}) {
  return form({ name: "Sugar", unit: "kg", stockQty: "1.25", lowStockThreshold: "0.5", ...overrides });
}

async function assertNoCafeteriaContext(db) {
  const { setting } = (await db.query(
    `SELECT current_setting('app.cafeteria_id', true) AS setting`,
  )).rows[0];
  assert.ok(!setting, "cafeteria context must not outlive its transaction");
}

test("supply creation reproduces the missing cafeteria error when context is omitted", async () => {
  const f = await fixture({ omitContext: true });
  try {
    assert.equal((await f.createSupply(newSupplyForm())).ok, false);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM "InventorySupply"')).rows[0].count, 2);
    assert.deepEqual(f.refreshedPaths, []);
    await assertNoCafeteriaContext(f.db);
  } finally {
    await f.db.close();
  }
});

test("supply creation uses staff ownership and converts quantities before refreshing both pages", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.createSupply(newSupplyForm({ cafeteriaId: "cafe-b" }))).ok, true);
    const row = (await f.db.query(`SELECT "cafeteriaId", "stockQty"::text AS stock,
      "lowStockThreshold"::text AS threshold, "canonicalUnit", "quantityCoverage", "isActive",
      "inventoryAlertStatus" FROM "InventorySupply" WHERE name='Sugar'`)).rows[0];
    assert.deepEqual(row, {
      cafeteriaId: "cafe-a", stock: "1250.000000", threshold: "500.000000",
      canonicalUnit: "GRAM", quantityCoverage: "COMPLETE", isActive: true, inventoryAlertStatus: "OK",
    });
    assert.deepEqual(f.refreshedPaths, ["/admin/inventory", "/inventory"]);
    await assertNoCafeteriaContext(f.db);

    f.setActor("other-staff");
    assert.equal((await f.createSupply(newSupplyForm({ name: "Salt", cafeteriaId: "cafe-a" }))).ok, true);
    assert.equal((await f.db.query(`SELECT "cafeteriaId" FROM "InventorySupply" WHERE name='Salt'`)).rows[0].cafeteriaId, "cafe-b");
    await assertNoCafeteriaContext(f.db);
  } finally {
    await f.db.close();
  }
});

test("supply creation rejects missing staff and missing cafeteria ownership", async () => {
  const f = await fixture({ actorId: "missing" });
  try {
    let result = await f.createSupply(newSupplyForm());
    assert.equal(result.ok, false);
    assert.match(result.error, /staff|sign in/i);

    f.setActor("staff");
    await f.db.exec('ALTER TABLE "Staff" ALTER COLUMN "cafeteriaId" DROP NOT NULL');
    for (const cafeteriaId of [null, ""]) {
      await f.db.query('UPDATE "Staff" SET "cafeteriaId"=$1 WHERE id=$2', [cafeteriaId, "staff"]);
      result = await f.createSupply(newSupplyForm());
      assert.equal(result.ok, false);
      assert.match(result.error, /cafeteria/i);
    }
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM "InventorySupply"')).rows[0].count, 2);
    assert.deepEqual(f.refreshedPaths, []);
    await assertNoCafeteriaContext(f.db);
  } finally {
    await f.db.close();
  }
});

test("supply creation supports the original schema without cafeteria columns", async () => {
  const f = await fixture();
  try {
    for (const table of ["Staff", "InventorySupply", "StockEvent", "InventoryMovement", "AuditLog"])
      await f.db.exec(`ALTER TABLE "${table}" DROP COLUMN "cafeteriaId"`);
    assert.equal((await f.createSupply(newSupplyForm())).ok, true);
    assert.equal((await f.db.query(`SELECT "stockQty"::text AS stock FROM "InventorySupply" WHERE name='Sugar'`)).rows[0].stock, "1250.000000");
    await assertNoCafeteriaContext(f.db);
  } finally {
    await f.db.close();
  }
});

test("supply creation preserves validation, zero defaults, counted units, and duplicate errors", async () => {
  const f = await fixture();
  try {
    for (const [overrides, field] of [
      [{ name: "" }, "name"],
      [{ unit: "custom package" }, "unit"],
      [{ stockQty: "-1" }, "stockQty"],
      [{ lowStockThreshold: "invalid" }, "lowStockThreshold"],
    ]) {
      const result = await f.createSupply(newSupplyForm(overrides));
      assert.equal(result.ok, false);
      assert.equal(result.field, field);
    }
    assert.deepEqual(f.refreshedPaths, []);
    assert.equal((await f.createSupply(newSupplyForm({ unit: "carton", countAsEntered: "yes", stockQty: "", lowStockThreshold: "" }))).ok, true);
    const row = (await f.db.query(`SELECT "stockQty"::text AS stock, "lowStockThreshold"::text AS threshold,
      "canonicalUnit" FROM "InventorySupply" WHERE name='Sugar'`)).rows[0];
    assert.deepEqual(row, { stock: "0.000000", threshold: "0.000000", canonicalUnit: "PIECE" });
    const result = await f.createSupply(newSupplyForm({ name: "Flour" }));
    assert.equal(result.ok, false);
    assert.equal(result.field, "name");
    assert.equal(result.error, "A supply with this name and unit already exists.");
    assert.equal(f.refreshedPaths.length, 2);
    await assertNoCafeteriaContext(f.db);
  } finally {
    await f.db.close();
  }
});

test("a failed supply insert rolls back cafeteria context and allows a clean retry", async () => {
  const f = await fixture();
  try {
    await f.db.exec(`ALTER TABLE "InventorySupply" ADD CONSTRAINT reject_sugar CHECK (name <> 'Sugar')`);
    assert.equal((await f.createSupply(newSupplyForm())).ok, false);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM "InventorySupply"')).rows[0].count, 2);
    assert.deepEqual(f.refreshedPaths, []);
    await assertNoCafeteriaContext(f.db);
    await f.db.exec('ALTER TABLE "InventorySupply" DROP CONSTRAINT reject_sugar');
    assert.equal((await f.createSupply(newSupplyForm())).ok, true);
    await assertNoCafeteriaContext(f.db);
  } finally {
    await f.db.close();
  }
});
