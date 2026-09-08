import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseGuestCount } from "../../src/lib/orders/guest-count";
import { countDineInCovers } from "../../src/lib/reports/cover-metrics";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("guest counts accept only whole numbers from 1 through 100", () => {
  assert.equal(parseGuestCount(1), 1);
  assert.equal(parseGuestCount("25"), 25);
  for (const value of [undefined, "", 0, 1.5, -1, 101, Number.NaN]) {
    assert.equal(parseGuestCount(value), null);
  }
});

test("guest count is stored once on the table check and protected by SQL", () => {
  const schema = source("prisma/schema.prisma");
  const migration = source(
    "prisma/migrations/20260908_table_check_guest_count/migration.sql",
  );
  assert.match(schema, /guestCount\s+Int\s+@default\(1\)/);
  assert.match(migration, /CHECK \("guestCount" BETWEEN 1 AND 100\)/);
});

test("table order validates covers and reuses the table check", () => {
  const route = source("src/app/api/orders/table/route.ts");
  assert.match(route, /parseGuestCount\(body\.guestCount\)/);
  assert.match(route, /tableCheck\.guestCount !== guestCount/);
  assert.match(route, /data: \{ guestCount \}/);
  assert.match(route, /table_check\.guest_count\.updated/);
});

test("sales reporting deduplicates table checks before counting covers", () => {
  assert.equal(
    countDineInCovers([
      {
        id: "round-1",
        type: "DINE_IN",
        tableCheckId: "check-1",
        guestCount: 4,
      },
      {
        id: "round-2",
        type: "DINE_IN",
        tableCheckId: "check-1",
        guestCount: 4,
      },
      {
        id: "legacy",
        type: "DINE_IN",
        tableCheckId: null,
        guestCount: null,
      },
      {
        id: "takeaway",
        type: "TAKEOUT",
        tableCheckId: null,
        guestCount: null,
      },
    ]),
    5,
  );

  const report = source("src/lib/reports/services/sales-report-service.ts");
  assert.match(report, /countDineInCovers/);
  assert.match(report, /salesPerCover/);
});
