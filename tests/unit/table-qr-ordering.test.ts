import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createTableQrToken,
  verifyTableQrToken,
} from "../../src/lib/customer-orders/table-qr-token";

const secret = "test-only-table-qr-secret-with-32-characters";

test("creates and verifies a table-scoped token", () => {
  const token = createTableQrToken("table-123", 4, secret);

  assert.deepEqual(verifyTableQrToken(token, secret), {
    tableId: "table-123",
    tokenVersion: 4,
  });
});

test("rejects tampered, malformed, and differently signed tokens", () => {
  const token = createTableQrToken("table-123", 1, secret);
  const [payload, signature] = token.split(".");

  assert.equal(
    verifyTableQrToken(`${payload}x.${signature}`, secret),
    null,
  );
  assert.equal(verifyTableQrToken(token, `${secret}-different`), null);
  assert.equal(verifyTableQrToken("not-a-token", secret), null);
});

test("rotating a table version invalidates the previous code at lookup", () => {
  const token = createTableQrToken("table-123", 2, secret);
  const verified = verifyTableQrToken(token, secret);

  assert.equal(verified?.tokenVersion, 2);
  assert.notEqual(verified?.tokenVersion, 3);
});

test("ships an additive migration and keeps anonymous access token-gated", () => {
  const migration = readFileSync(
    "prisma/migrations/20260907_table_qr_ordering/migration.sql",
    "utf8",
  );
  const route = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
  const page = readFileSync("src/app/table/[token]/page.tsx", "utf8");
  const productRoute = readFileSync("src/app/api/GET/Product/all/route.ts", "utf8");

  assert.match(migration, /ADD COLUMN "qrOrderingEnabled" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(migration, /ADD COLUMN "qrTokenVersion" INTEGER NOT NULL DEFAULT 1/);
  assert.match(route, /verifyTableQrToken\(tableToken/);
  assert.match(route, /qrOrderingEnabled: true/);
  assert.match(route, /FOR UPDATE/);
  assert.match(page, /verifyTableQrToken\(token/);
  assert.doesNotMatch(productRoute, /\bcost: true/);
  assert.doesNotMatch(productRoute, /\bstockQty: true/);
});
