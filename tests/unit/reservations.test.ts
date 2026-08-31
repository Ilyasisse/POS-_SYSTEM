import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReservationTransition,
  parseNairobiDateTime,
  parseReservationInput,
} from "../../src/lib/reservations/reservations";

test("parses Nairobi reservation times as UTC instants", () => {
  assert.equal(
    parseNairobiDateTime("2026-09-01T19:30").toISOString(),
    "2026-09-01T16:30:00.000Z",
  );
});

test("normalizes a future reservation", () => {
  assert.deepEqual(
    parseReservationInput(
      {
        kind: "RESERVATION",
        guestName: "  Amina Ali ",
        phone: " 0900000000 ",
        partySize: "5",
        scheduledAt: "2026-09-01T19:30",
        notes: " Window if available ",
      },
      new Date("2026-09-01T12:00:00.000Z"),
    ),
    {
      guestName: "Amina Ali",
      phone: "0900000000",
      partySize: 5,
      scheduledAt: new Date("2026-09-01T16:30:00.000Z"),
      status: "BOOKED",
      notes: "Window if available",
    },
  );
});

test("creates walk-ins directly on the waitlist", () => {
  const result = parseReservationInput({
    kind: "WAITLIST",
    guestName: "Ahmed",
    partySize: 2,
  });
  assert.equal(result.status, "WAITING");
  assert.equal(result.scheduledAt, null);
});

test("rejects invalid parties and past reservations", () => {
  assert.throws(
    () =>
      parseReservationInput({
        guestName: "Amina",
        partySize: 0,
        scheduledAt: "2026-09-01T19:30",
      }),
    /Party size/,
  );
  assert.throws(
    () =>
      parseReservationInput(
        {
          guestName: "Amina",
          partySize: 2,
          scheduledAt: "2026-09-01T10:00",
        },
        new Date("2026-09-01T12:00:00.000Z"),
      ),
    /cannot be in the past/,
  );
});

test("allows only supported lifecycle transitions", () => {
  assert.doesNotThrow(() => assertReservationTransition("BOOKED", "WAITING"));
  assert.doesNotThrow(() => assertReservationTransition("WAITING", "SEATED"));
  assert.doesNotThrow(() => assertReservationTransition("SEATED", "COMPLETED"));
  assert.throws(
    () => assertReservationTransition("COMPLETED", "WAITING"),
    /cannot move/,
  );
});
