import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  canSignOffOpeningTasks,
  getOpeningBusinessDate,
  OPENING_READINESS_TASKS,
} from "../../src/lib/operations/opening-readiness-rules";

test("opening date follows the 07:00 Nairobi cashier boundary", () => {
  assert.equal(
    getOpeningBusinessDate(new Date("2026-09-25T03:59:59Z")).toISOString(),
    "2026-09-24T00:00:00.000Z",
  );
  assert.equal(
    getOpeningBusinessDate(new Date("2026-09-25T04:00:00Z")).toISOString(),
    "2026-09-25T00:00:00.000Z",
  );
});

test("sign-off requires at least one task and every task checked", () => {
  assert.equal(canSignOffOpeningTasks([]), false);
  assert.equal(
    canSignOffOpeningTasks([{ checkedAt: new Date() }, { checkedAt: null }]),
    false,
  );
  assert.equal(
    canSignOffOpeningTasks(
      OPENING_READINESS_TASKS.map(() => ({ checkedAt: new Date() })),
    ),
    true,
  );
});

test("migration requires valid date ownership and paired check/signature fields", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Staff" ("id" TEXT PRIMARY KEY);
      INSERT INTO "Staff" ("id") VALUES ('manager');`);
    await db.exec(
      readFileSync(
        "prisma/migrations/20260925101500_opening_readiness_checklist/migration.sql",
        "utf8",
      ),
    );
    await db.query(
      `INSERT INTO "OpeningReadinessDay" ("businessDate", "startedByUserId") VALUES ($1, $2)`,
      ["2026-09-25", "manager"],
    );
    await db.query(
      `INSERT INTO "OpeningReadinessTask" ("businessDate", "key", "label") VALUES ($1, $2, $3)`,
      ["2026-09-25", "pos", "Check POS"],
    );
    await assert.rejects(
      db.query(
        `INSERT INTO "OpeningReadinessDay" ("businessDate", "startedByUserId") VALUES ($1, $2)`,
        ["2026-09-25", "manager"],
      ),
    );
    await assert.rejects(
      db.query(
        `UPDATE "OpeningReadinessTask" SET "checkedAt" = CURRENT_TIMESTAMP WHERE "key" = 'pos'`,
      ),
    );
    await assert.rejects(
      db.query(
        `UPDATE "OpeningReadinessDay" SET "signedByUserId" = 'manager' WHERE "businessDate" = '2026-09-25'`,
      ),
    );
    await db.query(
      `UPDATE "OpeningReadinessTask" SET "checkedAt" = CURRENT_TIMESTAMP, "checkedByUserId" = 'manager' WHERE "key" = 'pos'`,
    );
    await db.query(
      `UPDATE "OpeningReadinessDay" SET "signedAt" = CURRENT_TIMESTAMP, "signedByUserId" = 'manager' WHERE "businessDate" = '2026-09-25'`,
    );
  } finally {
    await db.close();
  }
});
