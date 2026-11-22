import { expect, test } from "@jest/globals";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../../prisma/migrations/20260916213000_separate_staff_customers/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

async function legacyDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CASHIER', 'CUSTOMER', 'SUPPLIER');
    CREATE TABLE "User" (
      "id" TEXT PRIMARY KEY, "phoneNumber" TEXT, "fullName" TEXT NOT NULL,
      "role" "UserRole" NOT NULL DEFAULT 'CASHIER', "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "email" TEXT NOT NULL, "station" TEXT
    );
    CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
    CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
    CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
    CREATE INDEX "User_station_idx" ON "User"("station");
    CREATE TABLE "Order" (
      "id" TEXT PRIMARY KEY,
      "customerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
      "cashierId" TEXT REFERENCES "User"("id") ON DELETE SET NULL
    );
    CREATE TABLE "AuditLog" ("id" TEXT PRIMARY KEY, "actorUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL);
    CREATE TABLE "StockEvent" ("id" TEXT PRIMARY KEY, "actorUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL);
    CREATE TABLE "KitchenTransitionEvent" ("id" TEXT PRIMARY KEY, "actorUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL);
    INSERT INTO "User" ("id", "fullName", "email", "role", "isActive") VALUES
      ('staff', 'Cashier', 'staff@example.com', 'CASHIER', true),
      ('customer', 'Customer', 'customer@example.com', 'CUSTOMER', true),
      ('inactive', 'Inactive Customer', 'inactive@example.com', 'CUSTOMER', false),
      ('supplier', 'Supplier', 'supplier@example.com', 'SUPPLIER', true);
    INSERT INTO "Order" VALUES ('order', 'customer', 'staff'), ('personal', 'staff', 'staff');
    INSERT INTO "AuditLog" VALUES ('audit', 'customer');
    INSERT INTO "StockEvent" VALUES ('stock', 'customer');
    INSERT INTO "KitchenTransitionEvent" VALUES ('kitchen', 'customer');
    CREATE FUNCTION reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'events are immutable'; END;
    $$;
    CREATE TRIGGER "StockEvent_immutable" BEFORE UPDATE OR DELETE ON "StockEvent" FOR EACH ROW EXECUTE FUNCTION reject_event_mutation();
    CREATE TRIGGER "KitchenTransitionEvent_immutable" BEFORE UPDATE OR DELETE ON "KitchenTransitionEvent" FOR EACH ROW EXECUTE FUNCTION reject_event_mutation();
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.auth_id', true) $$;
    CREATE FUNCTION public.can_receive_kitchen_realtime() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
      SELECT EXISTS(SELECT 1 FROM public."User" WHERE "id" = auth.uid() AND "isActive" AND "role"::text IN ('ADMIN','CASHIER'));
    $$;
    GRANT ALL ON "User" TO anon, authenticated;
  `);
  return db;
}

test("migration preserves profiles, personal orders and shared actor history", async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(migration);
    expect((await db.query(`SELECT to_regclass('"User"') AS name`)).rows[0].name).toBe(null);
    expect(
      (await db.query('SELECT "id" FROM "Staff" ORDER BY "id"')).rows.map((r) => r.id),
    ).toStrictEqual(["staff", "supplier"]);
    expect(
      (await db.query('SELECT "id" FROM "Customer" ORDER BY "id"')).rows.map((r) => r.id),
    ).toStrictEqual(["customer", "inactive", "staff"]);
    expect(
      (await db.query('SELECT "isActive" FROM "Customer" WHERE "id" = $1', ["inactive"])).rows[0]
        .isActive,
    ).toBe(false);
    expect((await db.query('SELECT * FROM "Order" ORDER BY "id"')).rows).toStrictEqual([
      { id: "order", customerId: "customer", cashierId: "staff" },
      { id: "personal", customerId: "staff", cashierId: "staff" },
    ]);
    for (const table of ["AuditLog", "StockEvent", "KitchenTransitionEvent"]) {
      expect(
        (await db.query(`SELECT "actorCustomerId" FROM "${table}"`)).rows[0].actorCustomerId,
      ).toBe("customer");
    }
    await expect(
      db.exec(`INSERT INTO "Order" VALUES ('invalid', NULL, 'customer')`),
    ).rejects.toThrow(/foreign key/);
    await expect(
      db.exec(`UPDATE "Staff" SET "role" = 'CUSTOMER' WHERE "id" = 'staff'`),
    ).rejects.toThrow(/check constraint/);
    for (const table of ["StockEvent", "KitchenTransitionEvent"]) {
      await expect(db.exec(`UPDATE "${table}" SET "actorCustomerId" = NULL`)).rejects.toThrow(
        /immutable/,
      );
    }
    await db.exec("SET ROLE authenticated");
    await db.exec("SET test.auth_id = 'staff'");
    expect(
      (await db.query("SELECT public.can_receive_kitchen_realtime() AS allowed")).rows[0].allowed,
    ).toBe(true);
    await db.exec("SET test.auth_id = 'customer'");
    expect(
      (await db.query("SELECT public.can_receive_kitchen_realtime() AS allowed")).rows[0].allowed,
    ).toBe(false);
    for (const table of ["Staff", "Customer"]) {
      await expect(db.query(`SELECT * FROM "${table}"`)).rejects.toThrow(/permission denied/);
    }
    await db.exec("RESET ROLE");
  } finally {
    await db.close();
  }
});

test("unexpected customer staff history rolls back instead of deleting or nulling it", async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(`UPDATE "Order" SET "cashierId" = 'customer' WHERE "id" = 'order'`);
    await expect(db.exec(migration)).rejects.toThrow(/Customer has staff-only history/);
    await db.exec("ROLLBACK");
    expect(
      (await db.query('SELECT "role" FROM "User" WHERE "id" = $1', ["customer"])).rows[0].role,
    ).toBe("CUSTOMER");
    expect(
      (await db.query('SELECT "cashierId" FROM "Order" WHERE "id" = $1', ["order"])).rows[0]
        .cashierId,
    ).toBe("customer");
    expect((await db.query(`SELECT to_regclass('"Staff"') AS table_name`)).rows[0].table_name).toBe(
      null,
    );
  } finally {
    await db.close();
  }
});
