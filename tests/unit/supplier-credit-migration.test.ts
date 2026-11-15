import { expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";

const migration = readFileSync("prisma/migrations/20260809_supplier_credits/migration.sql", "utf8");

test("supplier credit migration backfills supplier ownership and full allocations", () => {
  expect(migration).toMatch(
    /SET "supplierId" = bill\."supplierId"[\s\S]*payment\."billId" = bill\."id"/,
  );
  expect(migration).toMatch(
    /INSERT INTO "SupplierPaymentAllocation"[\s\S]*payment\."amount"[\s\S]*FROM "SupplierPayment"/,
  );
  expect(migration).toMatch(/payment\."installmentId"/);
});

test("legacy payment columns are dropped only after allocations are copied", () => {
  const backfill = migration.indexOf('INSERT INTO "SupplierPaymentAllocation"');
  const dropBillId = migration.indexOf('DROP COLUMN "billId"');
  const dropInstallmentId = migration.indexOf('DROP COLUMN "installmentId"');
  expect(backfill >= 0 && backfill < dropBillId).toBeTruthy();
  expect(backfill < dropInstallmentId).toBeTruthy();
});
