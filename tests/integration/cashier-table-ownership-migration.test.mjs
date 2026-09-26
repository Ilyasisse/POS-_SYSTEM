import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../../prisma/migrations/20260926110000_cashier_table_ownership_realtime/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("table owner is backfilled and follows open-order lifecycle", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "Staff" ("id" TEXT PRIMARY KEY, "role" TEXT NOT NULL);
      CREATE TABLE "Table" ("id" TEXT PRIMARY KEY, "isActive" BOOLEAN NOT NULL DEFAULT true);
      CREATE TABLE "Order" (
        "id" TEXT PRIMARY KEY,
        "tableId" TEXT,
        "cashierId" TEXT,
        "type" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL,
        "orderNumber" INTEGER NOT NULL
      );
      INSERT INTO "Staff" VALUES ('first', 'CASHIER'), ('second', 'CASHIER'), ('manager', 'MANAGER');
      INSERT INTO "Table" VALUES ('occupied', true), ('legacy', true), ('manager-table', true);
      INSERT INTO "Order" VALUES
        ('first-round', 'occupied', 'first', 'DINE_IN', 'OPEN', '2026-09-01', 1),
        ('second-round', 'occupied', 'second', 'DINE_IN', 'OPEN', '2026-09-02', 2),
        ('legacy-round', 'legacy', NULL, 'DINE_IN', 'OPEN', '2026-09-01', 3),
        ('manager-round', 'manager-table', 'manager', 'DINE_IN', 'OPEN', '2026-09-01', 4);
    `);
    await db.exec(migration);

    async function owner(tableId) {
      const result = await db.query(
        'SELECT "ownerCashierId" FROM "Table" WHERE "id" = $1',
        [tableId],
      );
      return result.rows[0].ownerCashierId;
    }

    assert.equal(await owner("occupied"), "first");
    assert.equal(await owner("legacy"), null);
    assert.equal(await owner("manager-table"), null);

    await db.query('UPDATE "Order" SET "status" = $1 WHERE "id" = $2', [
      "PAID",
      "first-round",
    ]);
    assert.equal(await owner("occupied"), "first");

    await db.query('UPDATE "Order" SET "status" = $1 WHERE "id" = $2', [
      "PAID",
      "second-round",
    ]);
    assert.equal(await owner("occupied"), null);

    await db.query('UPDATE "Order" SET "status" = $1 WHERE "id" = $2', [
      "OPEN",
      "first-round",
    ]);
    assert.equal(await owner("occupied"), "first");

    await db.query('UPDATE "Order" SET "status" = $1 WHERE "id" = $2', [
      "CANCELLED",
      "first-round",
    ]);
    assert.equal(await owner("occupied"), null);

    await db.query(
      `INSERT INTO "Order" VALUES
       ('claimed-round', 'legacy', 'second', 'DINE_IN', 'OPEN', '2026-09-03', 4)`,
    );
    assert.equal(await owner("legacy"), "second");
    await db.query('DELETE FROM "Order" WHERE "id" = $1', ["claimed-round"]);
    assert.equal(await owner("legacy"), "second");
    await db.query('UPDATE "Order" SET "status" = $1 WHERE "id" = $2', [
      "CANCELLED",
      "legacy-round",
    ]);
    assert.equal(await owner("legacy"), null);
  } finally {
    await db.close();
  }
});

test("cashier events use private topics and restrict topic access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE SCHEMA realtime;
      CREATE TABLE "Staff" (
        "id" TEXT PRIMARY KEY, "role" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL
      );
      CREATE TABLE "Table" ("id" TEXT PRIMARY KEY, "isActive" BOOLEAN NOT NULL DEFAULT true);
      CREATE TABLE "Order" (
        "id" TEXT PRIMARY KEY, "tableId" TEXT, "cashierId" TEXT,
        "type" TEXT NOT NULL, "status" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL, "orderNumber" INTEGER NOT NULL
      );
      CREATE TABLE "Payment" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL);
      CREATE TABLE realtime.messages (
        "id" SERIAL PRIMARY KEY, "extension" TEXT NOT NULL,
        "topic" TEXT NOT NULL, "payload" JSONB NOT NULL
      );
      ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION auth.uid() RETURNS TEXT LANGUAGE sql
        AS $$ SELECT current_setting('test.auth_id', true) $$;
      CREATE FUNCTION realtime.topic() RETURNS TEXT LANGUAGE sql
        AS $$ SELECT current_setting('test.topic', true) $$;
      CREATE FUNCTION realtime.send(jsonb, text, text, boolean)
      RETURNS void LANGUAGE plpgsql AS $$
        BEGIN
          INSERT INTO realtime.messages ("extension", "topic", "payload")
          VALUES ('broadcast', $3, $1);
        END;
      $$;
      INSERT INTO "Staff" VALUES
        ('cashier', 'CASHIER', true),
        ('other', 'CASHIER', true),
        ('manager', 'MANAGER', true);
      INSERT INTO "Table" VALUES ('table-1', true);
    `);
    await db.exec(migration);

    await db.exec(
      "SET test.auth_id = 'cashier'; SET test.topic = 'cashier:cashier'",
    );
    assert.equal(
      (
        await db.query(
          "SELECT app_private.can_receive_cashier_table_events() AS allowed",
        )
      ).rows[0].allowed,
      true,
    );
    await db.exec("SET test.topic = 'cashier:other'");
    assert.equal(
      (
        await db.query(
          "SELECT app_private.can_receive_cashier_table_events() AS allowed",
        )
      ).rows[0].allowed,
      false,
    );
    await db.exec("SET test.topic = 'cashier:all'");
    assert.equal(
      (
        await db.query(
          "SELECT app_private.can_receive_cashier_table_events() AS allowed",
        )
      ).rows[0].allowed,
      false,
    );
    await db.exec("SET test.auth_id = 'manager'");
    assert.equal(
      (
        await db.query(
          "SELECT app_private.can_receive_cashier_table_events() AS allowed",
        )
      ).rows[0].allowed,
      true,
    );

    await db.query(
      `INSERT INTO "Order" VALUES
       ('round-1', 'table-1', 'cashier', 'DINE_IN', 'OPEN', '2026-09-01', 1)`,
    );
    const topics = (
      await db.query(
        'SELECT DISTINCT "topic" FROM realtime.messages ORDER BY "topic"',
      )
    ).rows.map((row) => row.topic);
    assert.deepEqual(topics, ["cashier:all", "cashier:cashier"]);

    await db.exec("TRUNCATE realtime.messages");
    await db.query('INSERT INTO "Payment" VALUES ($1, $2)', [
      "payment-1",
      "round-1",
    ]);
    assert.deepEqual(
      (
        await db.query(
          'SELECT DISTINCT "topic" FROM realtime.messages ORDER BY "topic"',
        )
      ).rows.map((row) => row.topic),
      ["cashier:all", "cashier:cashier"],
    );

    await db.exec("TRUNCATE realtime.messages");
    await db.query('UPDATE "Order" SET "status" = $1 WHERE "id" = $2', [
      "PAID",
      "round-1",
    ]);
    assert.equal(
      (
        await db.query('SELECT "ownerCashierId" FROM "Table" WHERE "id" = $1', [
          "table-1",
        ])
      ).rows[0].ownerCashierId,
      null,
    );
    assert.deepEqual(
      (
        await db.query(
          'SELECT DISTINCT "topic" FROM realtime.messages ORDER BY "topic"',
        )
      ).rows.map((row) => row.topic),
      ["cashier:all", "cashier:cashier"],
    );
  } finally {
    await db.close();
  }
});
