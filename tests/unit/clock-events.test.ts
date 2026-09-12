import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedClockActions,
  assertClockTransition,
  calculateCompletedBreakMinutes,
} from "../../src/lib/staff/clock-events";

test("enforces the employee clock and break lifecycle", () => {
  assert.deepEqual(allowedClockActions(null), ["IN"]);
  assert.deepEqual(allowedClockActions("IN"), ["BREAK_START", "OUT"]);
  assert.deepEqual(allowedClockActions("BREAK_START"), ["BREAK_END"]);
  assert.deepEqual(allowedClockActions("BREAK_END"), ["BREAK_START", "OUT"]);
  assert.throws(() => assertClockTransition(null, "OUT"), /Cannot record/);
  assert.throws(() => assertClockTransition("BREAK_START", "OUT"), /Cannot record/);
});

test("adds all completed break intervals", () => {
  const at = (time: string) => new Date(`2026-09-01T${time}:00+03:00`);
  assert.equal(
    calculateCompletedBreakMinutes([
      { type: "IN", occurredAt: at("07:00") },
      { type: "BREAK_START", occurredAt: at("10:00") },
      { type: "BREAK_END", occurredAt: at("10:15") },
      { type: "BREAK_START", occurredAt: at("13:00") },
      { type: "BREAK_END", occurredAt: at("13:30") },
      { type: "OUT", occurredAt: at("16:00") },
    ]),
    45,
  );
});

test("ignores an incomplete break until it is ended", () => {
  assert.equal(
    calculateCompletedBreakMinutes([
      { type: "BREAK_START", occurredAt: new Date("2026-09-01T10:00:00Z") },
    ]),
    0,
  );
});
