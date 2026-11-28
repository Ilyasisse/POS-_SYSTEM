import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceOutcome,
  calculatePayrollLine,
} from "../../src/lib/payroll/payroll-formulas";
import {
  adjustmentWithinPayrollPeriod,
  attendanceForEmployment,
} from "../../src/lib/payroll/payroll-sources";

test("attendance applies the grace period and approved overtime threshold", () => {
  const outcome = attendanceOutcome({
    scheduledStart: new Date("2026-08-10T07:00:00+03:00"),
    clockIn: new Date("2026-08-10T07:13:00+03:00"),
    clockOut: new Date("2026-08-10T16:00:00+03:00"),
    graceMinutes: 10,
    overtimeThresholdMinutes: 480,
  });
  assert.equal(outcome.lateMinutes, 3);
  assert.equal(outcome.workedMinutes, 527);
  assert.equal(outcome.overtimeMinutes, 47);
});

test("daily and monthly payroll formulas preserve additions and deductions", () => {
  const daily = calculatePayrollLine({
    compensationType: "DAILY",
    dailyRate: "20",
    approvedAttendanceDays: 3,
    approvedOvertimeMinutes: 0,
    additions: "5",
    deductions: "7",
  });
  const monthly = calculatePayrollLine({
    compensationType: "MONTHLY",
    monthlySalary: "300",
    approvedAttendanceDays: 0,
    approvedOvertimeMinutes: 60,
    additions: "0",
    deductions: "10",
  });
  assert.equal(daily.netPay.toFixed(2), "58.00");
  assert.equal(monthly.netPay.toFixed(2), "291.25");
});

test("one adjustment cannot be charged in full to adjacent payroll periods", () => {
  const adjustment = {
    periodStart: new Date("2026-08-01"),
    periodEnd: new Date("2026-08-31"),
  };
  assert.equal(
    adjustmentWithinPayrollPeriod(adjustment, {
      periodStart: new Date("2026-08-01"),
      periodEnd: new Date("2026-08-15"),
    }),
    false,
  );
  assert.equal(
    adjustmentWithinPayrollPeriod(adjustment, {
      periodStart: new Date("2026-08-16"),
      periodEnd: new Date("2026-08-31"),
    }),
    false,
  );
  assert.equal(adjustmentWithinPayrollPeriod(adjustment, adjustment), true);
});

test("daily payroll excludes days outside employment dates and unapproved attendance", () => {
  const row = (date: string, extra = {}) => ({
    workerId: "worker",
    businessDate: new Date(date),
    status: "PRESENT",
    approvedAt: new Date("2026-08-31"),
    ...extra,
  });
  const eligible = attendanceForEmployment(
    [
      row("2026-08-09"),
      row("2026-08-10"),
      row("2026-08-15", { approvedAt: null }),
      row("2026-08-16", { status: "ABSENT" }),
      row("2026-08-17", { workerId: "other" }),
      row("2026-08-20"),
      row("2026-08-21"),
    ],
    {
      userId: "worker",
      effectiveFrom: new Date("2026-08-10"),
      effectiveTo: new Date("2026-08-20"),
    },
  );
  assert.deepEqual(
    eligible.map((item) => item.businessDate.toISOString().slice(0, 10)),
    ["2026-08-10", "2026-08-20"],
  );
  const line = calculatePayrollLine({
    compensationType: "DAILY",
    dailyRate: "20",
    approvedAttendanceDays: eligible.length,
    approvedOvertimeMinutes: 0,
  });
  assert.equal(line.basePay.toFixed(2), "40.00");
});

test("a standard eight-hour shift earns no overtime at the default threshold", () => {
  const outcome = attendanceOutcome({
    scheduledStart: new Date("2026-08-10T07:00:00+03:00"),
    clockIn: new Date("2026-08-10T07:00:00+03:00"),
    clockOut: new Date("2026-08-10T15:00:00+03:00"),
    graceMinutes: 10,
    overtimeThresholdMinutes: 480,
  });
  assert.equal(outcome.overtimeMinutes, 0);
});
