import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { parseCourseHoldInput } from "../../src/lib/kitchen/course-hold";

test("normal orders stay immediate with no course metadata", () => {
  assert.deepEqual(parseCourseHoldInput({}), {
    isHeld: false,
    courseLabel: null,
  });
  assert.deepEqual(parseCourseHoldInput({ holdForCourse: false }), {
    isHeld: false,
    courseLabel: null,
  });
});

test("held course names are trimmed and capped", () => {
  assert.deepEqual(
    parseCourseHoldInput({ holdForCourse: true, courseLabel: "  Desserts  " }),
    { isHeld: true, courseLabel: "Desserts" },
  );
  for (const input of [
    { holdForCourse: true },
    { holdForCourse: true, courseLabel: "  " },
    { holdForCourse: true, courseLabel: "x".repeat(41) },
    { holdForCourse: "true", courseLabel: "Desserts" },
    { holdForCourse: false, courseLabel: "Desserts" },
    { holdForCourse: true, courseLabel: 123 },
  ]) {
    assert.throws(() => parseCourseHoldInput(input));
  }
});

test("migration keeps existing tickets fired and supports held round fields", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TYPE "KitchenPickupStatus" AS ENUM ('PREPARING', 'READY', 'CLAIMED', 'DELIVERED');
      CREATE TABLE "KitchenTicketState" (
        "orderId" TEXT PRIMARY KEY,
        "pickupStatus" "KitchenPickupStatus" NOT NULL DEFAULT 'PREPARING',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO "KitchenTicketState" ("orderId") VALUES ('existing');
    `);
    await db.exec(
      readFileSync(
        "prisma/migrations/20260925100000_hold_fire_kitchen_rounds/migration.sql",
        "utf8",
      ),
    );
    const existing = await db.query<{ isHeld: boolean }>(
      `SELECT "isHeld" FROM "KitchenTicketState" WHERE "orderId" = 'existing'`,
    );
    assert.equal(existing.rows[0]?.isHeld, false);
    await db.query(
      `INSERT INTO "KitchenTicketState" ("orderId", "isHeld", "courseLabel") VALUES ($1, true, $2)`,
      ["held", "Desserts"],
    );
    const held = await db.query<{
      isHeld: boolean;
      courseLabel: string;
      firedAt: Date | null;
    }>(
      `SELECT "isHeld", "courseLabel", "firedAt" FROM "KitchenTicketState" WHERE "orderId" = 'held'`,
    );
    assert.equal(held.rows[0]?.isHeld, true);
    assert.equal(held.rows[0]?.courseLabel, "Desserts");
    assert.equal(held.rows[0]?.firedAt, null);
  } finally {
    await db.close();
  }
});
