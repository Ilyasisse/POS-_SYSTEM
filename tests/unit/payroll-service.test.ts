import test from "node:test";
import assert from "node:assert/strict";
import { attendanceOutcome, calculatePayrollLine } from "../../src/lib/payroll/payroll-formulas";

test("attendance applies the grace period and approved overtime threshold", () => {
  const outcome = attendanceOutcome({ scheduledStart: new Date("2026-08-10T07:00:00+03:00"), clockIn: new Date("2026-08-10T07:13:00+03:00"), clockOut: new Date("2026-08-10T16:00:00+03:00"), graceMinutes: 10, overtimeThresholdMinutes: 480 });
  assert.equal(outcome.lateMinutes, 3); assert.equal(outcome.workedMinutes, 527); assert.equal(outcome.overtimeMinutes, 47);
});

test("daily and monthly payroll formulas preserve additions and deductions", () => {
  const daily = calculatePayrollLine({ compensationType: "DAILY", dailyRate: "20", approvedAttendanceDays: 3, approvedOvertimeMinutes: 0, additions: "5", deductions: "7" });
  const monthly = calculatePayrollLine({ compensationType: "MONTHLY", monthlySalary: "300", approvedAttendanceDays: 0, approvedOvertimeMinutes: 60, additions: "0", deductions: "10" });
  assert.equal(daily.netPay.toFixed(2), "58.00"); assert.equal(monthly.netPay.toFixed(2), "291.25");
});
