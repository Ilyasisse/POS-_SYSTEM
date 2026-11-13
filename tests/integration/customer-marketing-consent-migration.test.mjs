import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("existing customers stay opted out when consent columns are added", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE TABLE "Customer" ("id" TEXT PRIMARY KEY); INSERT INTO "Customer" ("id") VALUES (\'existing\');',
    );
    await db.exec(
      readFileSync(
        new URL(
          "../../prisma/migrations/20260923063000_customer_marketing_email_consent/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const result = await db.query(
      'SELECT "marketingEmailConsentAt", "marketingEmailRevokedAt" FROM "Customer" WHERE "id" = \'existing\'',
    );
    assert.deepEqual(result.rows, [
      { marketingEmailConsentAt: null, marketingEmailRevokedAt: null },
    ]);
  } finally {
    await db.close();
  }
});
