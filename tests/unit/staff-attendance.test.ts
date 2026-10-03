import test from "node:test";
import assert from "node:assert/strict";
import { selectAttendanceSession } from "../../src/lib/staff/attendance-evidence";
import {
  formatStaffDateTime,
  parseStaffDateTime,
} from "../../src/lib/staff/staff-date-time";

const at = (time: string) => new Date(`2026-08-10T${time}:00+03:00`);
const shift = { startsAt: at("10:00"), endsAt: at("18:00") };
const event = (type: "IN" | "OUT", time: string) => ({
  type,
  occurredAt: at(time),
});

test("attendance uses the shift session when an earlier shift is inside the evidence window", () => {
  const session = selectAttendanceSession({
    ...shift,
    events: [
      event("IN", "05:00"),
      event("OUT", "09:00"),
      event("IN", "09:55"),
      event("OUT", "18:20"),
      event("IN", "19:00"),
      event("OUT", "23:00"),
    ],
  });
  assert.deepEqual(session, { clockIn: at("09:55"), clockOut: at("18:20") });
});

test("attendance rejects unrelated sessions and incomplete clock evidence", () => {
  assert.equal(
    selectAttendanceSession({
      ...shift,
      events: [event("IN", "05:00"), event("OUT", "09:00")],
    }),
    null,
  );
  assert.equal(
    selectAttendanceSession({ ...shift, events: [event("IN", "10:00")] }),
    null,
  );
  assert.equal(
    selectAttendanceSession({ ...shift, events: [event("OUT", "18:00")] }),
    null,
  );
});

test("attendance handles overnight shifts with a clock-out on the following date", () => {
  const clockIn = new Date("2026-08-10T22:00:00+03:00");
  const clockOut = new Date("2026-08-11T06:00:00+03:00");
  assert.deepEqual(
    selectAttendanceSession({
      startsAt: clockIn,
      endsAt: clockOut,
      events: [
        { type: "IN", occurredAt: clockIn },
        { type: "OUT", occurredAt: clockOut },
      ],
    }),
    { clockIn, clockOut },
  );
});

test("shift fields are interpreted in Nairobi time on any server", () => {
  assert.equal(
    parseStaffDateTime("2026-08-10T07:00").toISOString(),
    "2026-08-10T04:00:00.000Z",
  );
  assert.equal(
    parseStaffDateTime("2026-08-10T00:30").toISOString(),
    "2026-08-09T21:30:00.000Z",
  );
  assert.equal(
    formatStaffDateTime(parseStaffDateTime("2026-08-10T07:00")),
    formatStaffDateTime(new Date("2026-08-10T07:00:00+03:00")),
  );
});

test("shift fields reject invalid calendar dates and times instead of rolling them over", () => {
  for (const value of [
    "2026-02-30T07:00",
    "2026-08-10T24:00",
    "2026-08-10T07:60",
    "",
    "2026-08-10T07:00Z",
  ]) {
    assert.throws(() => parseStaffDateTime(value), /valid shift date and time/);
  }
});
