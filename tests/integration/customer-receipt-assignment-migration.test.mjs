import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL(
    "../../prisma/migrations/20260920163000_customer_checkout_receipt_assignments/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("customer and cashier receipt assignments satisfy the updated constraint", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TYPE "MobileMoneyReceiptStatus" AS ENUM (
        'AVAILABLE',
        'ASSIGNED',
        'OUTGOING',
        'NEEDS_REVIEW'
      );
      CREATE TABLE "MobileMoneyReceipt" (
        "id" TEXT PRIMARY KEY,
        "status" "MobileMoneyReceiptStatus" NOT NULL,
        "assignedPaymentRequestId" TEXT,
        "assignedByUserId" TEXT,
        "assignedAt" TIMESTAMP(3),
        CONSTRAINT "MobileMoneyReceipt_assignment_check"
          CHECK (
            (
              "status" = 'ASSIGNED'
              AND "assignedPaymentRequestId" IS NOT NULL
              AND "assignedByUserId" IS NOT NULL
              AND "assignedAt" IS NOT NULL
            )
            OR
            (
              "status" <> 'ASSIGNED'
              AND "assignedPaymentRequestId" IS NULL
              AND "assignedByUserId" IS NULL
              AND "assignedAt" IS NULL
            )
          )
      );
      INSERT INTO "MobileMoneyReceipt" ("id", "status")
      VALUES ('customer-receipt', 'AVAILABLE');
    `);

    await db.exec(migration);
    await db.exec(`
      UPDATE "MobileMoneyReceipt"
      SET "status" = 'ASSIGNED', "assignedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'customer-receipt';

      INSERT INTO "MobileMoneyReceipt" (
        "id",
        "status",
        "assignedPaymentRequestId",
        "assignedByUserId",
        "assignedAt"
      )
      VALUES (
        'cashier-receipt',
        'ASSIGNED',
        'payment-request-1',
        'cashier-1',
        CURRENT_TIMESTAMP
      );
    `);

    const result = await db.query(
      `SELECT "id", "status", "assignedPaymentRequestId", "assignedByUserId"
       FROM "MobileMoneyReceipt"
       ORDER BY "id"`,
    );
    assert.deepEqual(result.rows, [
      {
        id: "cashier-receipt",
        status: "ASSIGNED",
        assignedPaymentRequestId: "payment-request-1",
        assignedByUserId: "cashier-1",
      },
      {
        id: "customer-receipt",
        status: "ASSIGNED",
        assignedPaymentRequestId: null,
        assignedByUserId: null,
      },
    ]);

    await assert.rejects(
      db.exec(`
        INSERT INTO "MobileMoneyReceipt" ("id", "status")
        VALUES ('missing-assigned-at', 'ASSIGNED');
      `),
    );
    await assert.rejects(
      db.exec(`
        INSERT INTO "MobileMoneyReceipt" (
          "id",
          "status",
          "assignedPaymentRequestId",
          "assignedAt"
        )
        VALUES (
          'cashier-without-user',
          'ASSIGNED',
          'payment-request-2',
          CURRENT_TIMESTAMP
        );
      `),
    );
    await assert.rejects(
      db.exec(`
        INSERT INTO "MobileMoneyReceipt" ("id", "status", "assignedAt")
        VALUES ('available-with-assignment', 'AVAILABLE', CURRENT_TIMESTAMP);
      `),
    );
  } finally {
    await db.close();
  }
});
