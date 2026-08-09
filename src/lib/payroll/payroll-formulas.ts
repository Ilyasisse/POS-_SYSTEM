import { Prisma } from "@prisma/client";

export const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

export function attendanceMinutes(clockIn: Date | null, clockOut: Date | null) {
  return clockIn && clockOut && clockOut > clockIn
    ? Math.floor((clockOut.getTime() - clockIn.getTime()) / 60_000)
    : 0;
}

export function attendanceOutcome(input: { scheduledStart: Date; clockIn: Date | null; clockOut: Date | null; graceMinutes: number; overtimeThresholdMinutes: number }) {
  const workedMinutes = attendanceMinutes(input.clockIn, input.clockOut);
  const lateMinutes = input.clockIn ? Math.max(0, Math.floor((input.clockIn.getTime() - input.scheduledStart.getTime()) / 60_000) - input.graceMinutes) : 0;
  return { workedMinutes, lateMinutes, overtimeMinutes: Math.max(0, workedMinutes - input.overtimeThresholdMinutes) };
}

export function calculatePayrollLine(input: { compensationType: "DAILY" | "MONTHLY"; dailyRate?: Prisma.Decimal.Value | null; monthlySalary?: Prisma.Decimal.Value | null; approvedAttendanceDays: number; approvedOvertimeMinutes: number; additions?: Prisma.Decimal.Value; deductions?: Prisma.Decimal.Value; overtimeHourlyRate?: Prisma.Decimal.Value }) {
  const zero = money(0);
  const basePay = input.compensationType === "DAILY" ? money(input.dailyRate ?? 0).times(input.approvedAttendanceDays) : money(input.monthlySalary ?? 0);
  const overtimePay = money(input.overtimeHourlyRate ?? (input.compensationType === "DAILY" ? money(input.dailyRate ?? 0).div(8) : money(input.monthlySalary ?? 0).div(30).div(8))).times(input.approvedOvertimeMinutes).div(60);
  const additions = money(input.additions ?? zero);
  const deductions = money(input.deductions ?? zero);
  return { basePay, overtimePay, additions, deductions, netPay: basePay.plus(overtimePay).plus(additions).minus(deductions) };
}
