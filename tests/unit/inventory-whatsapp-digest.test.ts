import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  formatInventoryWhatsAppDigest,
  inventoryDigestDate,
} from "../../src/lib/inventory/whatsapp-digest";

test("uses the Nairobi day across midnight UTC", () => {
  assert.equal(
    inventoryDigestDate(new Date("2026-09-24T20:59:59Z")),
    "2026-09-24",
  );
  assert.equal(
    inventoryDigestDate(new Date("2026-09-24T21:00:00Z")),
    "2026-09-25",
  );
});

test("summarizes low stock without sending a message for an empty list", () => {
  assert.equal(formatInventoryWhatsAppDigest([], "2026-09-25"), null);
  const items = Array.from({ length: 13 }, (_, index) => ({
    name: `Milk ${index}\nspoof`,
    kind: "Supply" as const,
    quantity: "0",
    threshold: "3",
    unit: "litre",
  }));
  const summary = formatInventoryWhatsAppDigest(items, "2026-09-25");
  assert.match(summary ?? "", /13 item\(s\)/);
  assert.match(summary ?? "", /\+1 more/);
  assert.doesNotMatch(summary ?? "", /Milk 12/);
  assert.doesNotMatch(summary ?? "", /Milk 0\nspoof/);
});

test("database allows one delivery claim per café day", async () => {
  const db = new PGlite();
  try {
    const sql = await readFile(
      new URL(
        "../../prisma/migrations/20260924_inventory_whatsapp_digest/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql);
    await db.query(
      `INSERT INTO "InventoryWhatsAppDigest" ("digestDate", "summary", "updatedAt") VALUES ('2026-09-25', 'test', now())`,
    );
    await assert.rejects(
      db.query(
        `INSERT INTO "InventoryWhatsAppDigest" ("digestDate", "summary", "updatedAt") VALUES ('2026-09-25', 'duplicate', now())`,
      ),
      /duplicate key/,
    );
    await assert.rejects(
      db.query(
        `UPDATE "InventoryWhatsAppDigest" SET "status" = 'UNKNOWN' WHERE "digestDate" = '2026-09-25'`,
      ),
      /check constraint/,
    );
  } finally {
    await db.close();
  }
});
