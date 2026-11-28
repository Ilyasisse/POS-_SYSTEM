import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  parseHandoverDraft,
  requiredHandoverText,
} from "../../src/lib/operations/shift-handover-rules";

const token = "5ab8210e-9e18-4a11-813d-2be095401dbc";

test("handover input trims text and requires a valid idempotency token", () => {
  assert.deepEqual(
    parseHandoverDraft({
      title: "  Milk delivery  ",
      details: "  Call supplier at 8 am.  ",
      requestToken: token,
    }),
    {
      title: "Milk delivery",
      details: "Call supplier at 8 am.",
      requestToken: token,
    },
  );
  assert.throws(() =>
    parseHandoverDraft({
      title: "Okay",
      details: "Call supplier at 8 am.",
      requestToken: token,
    }),
  );
  assert.throws(() =>
    parseHandoverDraft({
      title: "Milk delivery",
      details: "short",
      requestToken: token,
    }),
  );
  assert.throws(() =>
    parseHandoverDraft({
      title: "Milk delivery",
      details: "Call supplier at 8 am.",
      requestToken: "not-a-uuid",
    }),
  );
  assert.equal(requiredHandoverText(" done ", "Resolution", 3, 1000), "done");
});

test("migration rejects duplicate retries and incomplete resolutions", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE "Staff" ("id" TEXT PRIMARY KEY); INSERT INTO "Staff" ("id") VALUES ('cashier');`,
    );
    await db.exec(
      readFileSync(
        "prisma/migrations/20260925103000_front_shift_handover/migration.sql",
        "utf8",
      ),
    );
    await db.query(
      `INSERT INTO "ShiftHandoverNote" ("id", "requestToken", "title", "details", "createdByUserId") VALUES ($1, $2, $3, $4, $5)`,
      ["one", token, "Milk delivery", "Call the supplier at 8 am", "cashier"],
    );
    await assert.rejects(
      db.query(
        `INSERT INTO "ShiftHandoverNote" ("id", "requestToken", "title", "details", "createdByUserId") VALUES ('two', $1, 'Milk delivery', 'Call the supplier at 8 am', 'cashier')`,
        [token],
      ),
    );
    await assert.rejects(
      db.query(
        `UPDATE "ShiftHandoverNote" SET "resolvedAt" = CURRENT_TIMESTAMP WHERE "id" = 'one'`,
      ),
    );
    await assert.rejects(
      db.query(
        `UPDATE "ShiftHandoverNote" SET "resolutionNote" = 'ok', "resolvedByUserId" = 'cashier', "resolvedAt" = CURRENT_TIMESTAMP WHERE "id" = 'one'`,
      ),
    );
    await db.query(
      `UPDATE "ShiftHandoverNote" SET "resolutionNote" = 'Supplier contacted', "resolvedByUserId" = 'cashier', "resolvedAt" = CURRENT_TIMESTAMP WHERE "id" = 'one'`,
    );
    const done = await db.query<{ resolved: boolean }>(
      `SELECT "resolvedAt" IS NOT NULL AS resolved FROM "ShiftHandoverNote" WHERE "id" = 'one'`,
    );
    assert.equal(done.rows[0]?.resolved, true);
  } finally {
    await db.close();
  }
});
