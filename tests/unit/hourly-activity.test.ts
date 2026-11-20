import assert from "node:assert/strict";
import test from "node:test";
import { rankHourlyActivity } from "../../src/lib/reports/hourly-activity";

test("ranks only observed hours by paid order volume and net sales ties", () => {
  const hours = [
    { hour: "9", orders: 2, amount: "25.00" },
    { hour: "11", orders: 3, amount: "10.00" },
    { hour: "8", orders: 2, amount: "30.00" },
  ];
  assert.deepEqual(
    rankHourlyActivity(hours).map((row) => row.hour),
    ["11", "8", "9"],
  );
  assert.equal(hours[0].hour, "9");
  assert.deepEqual(rankHourlyActivity([]), []);
});
