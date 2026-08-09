import assert from "node:assert/strict";
import test from "node:test";
import { getPermissionsForRole, PERMISSIONS } from "../../src/lib/auth/permissions";
import {
  calculateKitchenPreparationMetric,
  formatPreparationDuration,
  canCompleteCleaningRun,
  calculateIncidentDurationSeconds,
  isCleaningRunOverdue,
} from "../../src/lib/kitchen/kitchen-metrics";

test("preparation time comes from append-only start and completion events", () => {
  const result = calculateKitchenPreparationMetric([
    { type: "STATION_CREATED", occurredAt: new Date("2026-08-09T07:00:00Z"), targetMinutesSnapshot: 15 },
    { type: "STATION_STARTED", occurredAt: new Date("2026-08-09T07:02:00Z"), targetMinutesSnapshot: 15 },
    { type: "STATION_COMPLETED", occurredAt: new Date("2026-08-09T07:14:30Z"), targetMinutesSnapshot: 15 },
  ]);
  assert.equal(result.preparationSeconds, 750);
  assert.equal(result.coverage, "COMPLETE");
  assert.equal(result.isLate, false);
});

test("SLA breaches use the snapshotted target", () => {
  const result = calculateKitchenPreparationMetric([
    { type: "STATION_STARTED", occurredAt: new Date("2026-08-09T07:00:00Z"), targetMinutesSnapshot: 10 },
    { type: "STATION_COMPLETED", occurredAt: new Date("2026-08-09T07:11:00Z"), targetMinutesSnapshot: 99 },
  ]);
  assert.equal(result.targetMinutes, 10);
  assert.equal(result.isLate, true);
});

test("an active preparation reports elapsed duration without mutable updatedAt", () => {
  const result = calculateKitchenPreparationMetric(
    [{ type: "STATION_STARTED", occurredAt: new Date("2026-08-09T07:00:00Z"), targetMinutesSnapshot: 5 }],
    new Date("2026-08-09T07:03:30Z"),
  );
  assert.equal(result.preparationSeconds, 210);
  assert.equal(result.coverage, "IN_PROGRESS");
});

test("history before transition capture is explicitly unavailable", () => {
  assert.deepEqual(calculateKitchenPreparationMetric([]), {
    startedAt: null,
    completedAt: null,
    preparationSeconds: null,
    targetMinutes: null,
    isLate: null,
    coverage: "UNAVAILABLE",
  });
});

test("reopened work remains in progress until the final completion", () => {
  const result = calculateKitchenPreparationMetric(
    [
      { type: "STATION_STARTED", occurredAt: new Date("2026-08-09T07:00:00Z"), targetMinutesSnapshot: 10 },
      { type: "STATION_COMPLETED", occurredAt: new Date("2026-08-09T07:05:00Z"), targetMinutesSnapshot: 10 },
      { type: "STATION_REOPENED", occurredAt: new Date("2026-08-09T07:06:00Z"), targetMinutesSnapshot: 10 },
    ],
    new Date("2026-08-09T07:08:00Z"),
  );
  assert.equal(result.completedAt, null);
  assert.equal(result.preparationSeconds, 480);
  assert.equal(result.coverage, "IN_PROGRESS");
});

test("duration formatting is deterministic", () => {
  assert.equal(formatPreparationDuration(125), "2m 5s");
  assert.equal(formatPreparationDuration(null), "Unavailable");
});

test("manager and operational roles receive scoped permissions", () => {
  const manager = getPermissionsForRole("MANAGER");
  const cook = getPermissionsForRole("COOK");
  const cleaner = getPermissionsForRole("CLEANER");
  assert.ok(manager.includes(PERMISSIONS.KITCHEN_TARGET_MANAGE));
  assert.ok(manager.includes(PERMISSIONS.OPERATIONS_INCIDENT_MANAGE));
  assert.ok(!cook.includes(PERMISSIONS.OPERATIONS_INCIDENT_MANAGE));
  assert.ok(cook.includes(PERMISSIONS.KITCHEN_QUALITY_RECORD));
  assert.ok(cleaner.includes(PERMISSIONS.CLEANING_COMPLETE));
});

test("cleaning completion requires every required task", () => {
  assert.equal(canCompleteCleaningRun([{ isRequired: true, completed: false }]), false);
  assert.equal(canCompleteCleaningRun([
    { isRequired: true, completed: true },
    { isRequired: false, completed: false },
  ]), true);
});

test("incident duration and overdue cleaning use explicit timestamps", () => {
  const startedAt = new Date("2026-08-09T07:00:00Z");
  assert.equal(calculateIncidentDurationSeconds(startedAt, new Date("2026-08-09T07:05:00Z")), 300);
  assert.equal(isCleaningRunOverdue("PENDING", startedAt, new Date("2026-08-09T07:01:00Z")), true);
  assert.equal(isCleaningRunOverdue("COMPLETED", startedAt, new Date("2026-08-09T07:01:00Z")), false);
});
