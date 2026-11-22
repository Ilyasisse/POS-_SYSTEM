import { expect, test } from "@jest/globals";

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
    {
      type: "STATION_CREATED",
      occurredAt: new Date("2026-08-09T07:00:00Z"),
      targetMinutesSnapshot: 15,
    },
    {
      type: "STATION_STARTED",
      occurredAt: new Date("2026-08-09T07:02:00Z"),
      targetMinutesSnapshot: 15,
    },
    {
      type: "STATION_COMPLETED",
      occurredAt: new Date("2026-08-09T07:14:30Z"),
      targetMinutesSnapshot: 15,
    },
  ]);
  expect(result.preparationSeconds).toBe(750);
  expect(result.coverage).toBe("COMPLETE");
  expect(result.isLate).toBe(false);
});

test("SLA breaches use the snapshotted target", () => {
  const result = calculateKitchenPreparationMetric([
    {
      type: "STATION_STARTED",
      occurredAt: new Date("2026-08-09T07:00:00Z"),
      targetMinutesSnapshot: 10,
    },
    {
      type: "STATION_COMPLETED",
      occurredAt: new Date("2026-08-09T07:11:00Z"),
      targetMinutesSnapshot: 99,
    },
  ]);
  expect(result.targetMinutes).toBe(10);
  expect(result.isLate).toBe(true);
});

test("an active preparation reports elapsed duration without mutable updatedAt", () => {
  const result = calculateKitchenPreparationMetric(
    [
      {
        type: "STATION_STARTED",
        occurredAt: new Date("2026-08-09T07:00:00Z"),
        targetMinutesSnapshot: 5,
      },
    ],
    new Date("2026-08-09T07:03:30Z"),
  );
  expect(result.preparationSeconds).toBe(210);
  expect(result.coverage).toBe("IN_PROGRESS");
});

test("history before transition capture is explicitly unavailable", () => {
  expect(calculateKitchenPreparationMetric([])).toStrictEqual({
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
      {
        type: "STATION_STARTED",
        occurredAt: new Date("2026-08-09T07:00:00Z"),
        targetMinutesSnapshot: 10,
      },
      {
        type: "STATION_COMPLETED",
        occurredAt: new Date("2026-08-09T07:05:00Z"),
        targetMinutesSnapshot: 10,
      },
      {
        type: "STATION_REOPENED",
        occurredAt: new Date("2026-08-09T07:06:00Z"),
        targetMinutesSnapshot: 10,
      },
    ],
    new Date("2026-08-09T07:08:00Z"),
  );
  expect(result.completedAt).toBe(null);
  expect(result.preparationSeconds).toBe(480);
  expect(result.coverage).toBe("IN_PROGRESS");
});

test("duration formatting is deterministic", () => {
  expect(formatPreparationDuration(125)).toBe("2m 5s");
  expect(formatPreparationDuration(null)).toBe("Unavailable");
});

test("manager and operational roles receive scoped permissions", () => {
  const manager = getPermissionsForRole("MANAGER");
  const cook = getPermissionsForRole("COOK");
  const cleaner = getPermissionsForRole("CLEANER");
  expect(manager.includes(PERMISSIONS.KITCHEN_TARGET_MANAGE)).toBeTruthy();
  expect(manager.includes(PERMISSIONS.OPERATIONS_INCIDENT_MANAGE)).toBeTruthy();
  expect(!cook.includes(PERMISSIONS.OPERATIONS_INCIDENT_MANAGE)).toBeTruthy();
  expect(cook.includes(PERMISSIONS.KITCHEN_QUALITY_RECORD)).toBeTruthy();
  expect(cleaner.includes(PERMISSIONS.CLEANING_COMPLETE)).toBeTruthy();
});

test("cleaning completion requires every required task", () => {
  expect(canCompleteCleaningRun([{ isRequired: true, completed: false }])).toBe(false);
  expect(
    canCompleteCleaningRun([
      { isRequired: true, completed: true },
      { isRequired: false, completed: false },
    ]),
  ).toBe(true);
});

test("incident duration and overdue cleaning use explicit timestamps", () => {
  const startedAt = new Date("2026-08-09T07:00:00Z");
  expect(calculateIncidentDurationSeconds(startedAt, new Date("2026-08-09T07:05:00Z"))).toBe(300);
  expect(isCleaningRunOverdue("PENDING", startedAt, new Date("2026-08-09T07:01:00Z"))).toBe(true);
  expect(isCleaningRunOverdue("COMPLETED", startedAt, new Date("2026-08-09T07:01:00Z"))).toBe(
    false,
  );
});
