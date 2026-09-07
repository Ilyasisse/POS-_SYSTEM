import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatTimeInput,
  isOnlineOrderingOpen,
  parseTimeInput,
} from "../../src/lib/customer/online-ordering-hours";

const timezone = "Africa/Nairobi";

test("time input parsing accepts valid values and rejects invalid values", () => {
  assert.equal(parseTimeInput("07:30"), 450);
  assert.equal(parseTimeInput("23:59"), 1439);
  assert.equal(parseTimeInput("24:00"), null);
  assert.equal(parseTimeInput("7:30"), null);
  assert.equal(formatTimeInput(450), "07:30");
});

test("same start and end means enabled all-day ordering", () => {
  assert.equal(
    isOnlineOrderingOpen(
      { enabled: true, startMinute: 0, endMinute: 0, timezone },
      new Date("2026-09-07T12:00:00.000Z"),
    ),
    true,
  );
  assert.equal(
    isOnlineOrderingOpen(
      { enabled: false, startMinute: 0, endMinute: 0, timezone },
      new Date("2026-09-07T12:00:00.000Z"),
    ),
    false,
  );
});

test("daytime windows use the configured business timezone", () => {
  const schedule = {
    enabled: true,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
    timezone,
  };

  assert.equal(
    isOnlineOrderingOpen(schedule, new Date("2026-09-07T07:00:00.000Z")),
    true,
  );
  assert.equal(
    isOnlineOrderingOpen(schedule, new Date("2026-09-07T15:00:00.000Z")),
    false,
  );
});

test("overnight windows remain open across midnight", () => {
  const schedule = {
    enabled: true,
    startMinute: 20 * 60,
    endMinute: 2 * 60,
    timezone,
  };

  assert.equal(
    isOnlineOrderingOpen(schedule, new Date("2026-09-07T19:00:00.000Z")),
    true,
  );
  assert.equal(
    isOnlineOrderingOpen(schedule, new Date("2026-09-07T22:00:00.000Z")),
    true,
  );
  assert.equal(
    isOnlineOrderingOpen(schedule, new Date("2026-09-07T09:00:00.000Z")),
    false,
  );
});

test("customer checkout is gated and settings changes are audited", async () => {
  const [route, action] = await Promise.all([
    readFile(
      new URL("../../src/app/api/customer/orders/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../src/app/admin/settings/actions.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(route, /ONLINE_ORDERING_CLOSED/);
  assert.match(route, /isOnlineOrderingOpen/);
  assert.match(action, /settings\.online_ordering\.updated/);
  assert.match(action, /SETTINGS_MANAGE/);
});
