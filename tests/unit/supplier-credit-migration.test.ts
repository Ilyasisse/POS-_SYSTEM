import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260809_supplier_credits/migration.sql",
  "utf8",
);

test("supplier credit migration backfills supplier ownership and full allocations", () => {
  assert.match(
    migration,
    /SET "supplierId" = bill\."supplierId"[\s\S]*payment\."billId" = bill\."id"/,
  );
  assert.match(
    migration,
    /INSERT INTO "SupplierPaymentAllocation"[\s\S]*payment\."amount"[\s\S]*FROM "SupplierPayment"/,
  );
  assert.match(migration, /payment\."installmentId"/);
});

test("legacy payment columns are dropped only after allocations are copied", () => {
  const backfill = migration.indexOf('INSERT INTO "SupplierPaymentAllocation"');
  const dropBillId = migration.indexOf('DROP COLUMN "billId"');
  const dropInstallmentId = migration.indexOf('DROP COLUMN "installmentId"');
  assert.ok(backfill >= 0 && backfill < dropBillId);
  assert.ok(backfill < dropInstallmentId);
});
