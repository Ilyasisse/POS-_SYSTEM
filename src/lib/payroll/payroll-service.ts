import { prisma } from "@/lib/prisma";
import { calculatePayrollLine, money } from "./payroll-formulas";

export { attendanceMinutes, attendanceOutcome, calculatePayrollLine } from "./payroll-formulas";

export async function assertNoFinalizedPayroll(workerId: string, periodStart: Date, periodEnd: Date) {
  const existing = await prisma.payrollLine.findFirst({ where: { workerId, payrollRun: { status: "FINALIZED", periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } } }, select: { id: true } });
  if (existing) throw new Error("A finalized payroll already covers this worker and period.");
}

export async function buildPayrollRun(input: { periodStart: Date; periodEnd: Date; actorUserId: string }) {
  const [profiles, attendance, adjustments] = await Promise.all([
    prisma.employmentProfile.findMany({ where: { status: "ACTIVE", effectiveFrom: { lte: input.periodEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.periodStart } }] }, include: { user: { select: { id: true, fullName: true } } } }),
    prisma.attendanceRecord.findMany({ where: { businessDate: { gte: input.periodStart, lte: input.periodEnd }, status: "PRESENT" } }),
    prisma.payrollAdjustment.findMany({ where: { periodStart: { gte: input.periodStart }, periodEnd: { lte: input.periodEnd }, approvedAt: { not: null } } }),
  ]);
  const lines = profiles.map((profile) => {
    const workerAttendance = attendance.filter((row) => row.workerId === profile.userId);
    const workerAdjustments = adjustments.filter((row) => row.workerId === profile.userId);
    const additions = workerAdjustments.filter((row) => ["BONUS", "CORRECTION", "OVERTIME"].includes(row.type)).reduce((sum, row) => sum.plus(row.amount), money(0));
    const deductions = workerAdjustments.filter((row) => ["ADVANCE", "ABSENCE_DEDUCTION"].includes(row.type)).reduce((sum, row) => sum.plus(row.amount), money(0));
    const approvedOvertimeMinutes = workerAttendance.reduce((sum, row) => sum + row.approvedOvertimeMinutes, 0);
    const calculated = calculatePayrollLine({ compensationType: profile.compensationType, dailyRate: profile.dailyRate, monthlySalary: profile.monthlySalary, approvedAttendanceDays: workerAttendance.length, approvedOvertimeMinutes, additions, deductions });
    return { workerId: profile.userId, compensationType: profile.compensationType, ...calculated, attendanceDays: workerAttendance.length, overtimeMinutes: approvedOvertimeMinutes, snapshot: { employee: profile.user.fullName, profile: { dailyRate: profile.dailyRate?.toFixed(2) ?? null, monthlySalary: profile.monthlySalary?.toFixed(2) ?? null }, adjustmentIds: workerAdjustments.map((row) => row.id) } };
  });
  return prisma.$transaction(async (tx) => {
    for (const line of lines) await assertNoFinalizedPayroll(line.workerId, input.periodStart, input.periodEnd);
    return tx.payrollRun.create({ data: { periodStart: input.periodStart, periodEnd: input.periodEnd, createdByUserId: input.actorUserId, lines: { create: lines.map((line) => ({ ...line, basePay: line.basePay, overtimePay: line.overtimePay, additions: line.additions, deductions: line.deductions, netPay: line.netPay })) } }, include: { lines: true } });
  });
}
