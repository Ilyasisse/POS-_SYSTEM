import "server-only";

import { Prisma, type AttendanceStatus, type ClockEventType, type CompensationType, type EmploymentStatus, type PayrollAdjustmentType, type Station } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attendanceOutcome, calculatePayrollLine, money } from "@/lib/payroll/payroll-formulas";
import { formatBusinessDate } from "@/lib/reports/reporting-calendar";
import { publishReportInvalidation } from "@/lib/reports/report-realtime";

const SERIALIZABLE = Prisma.TransactionIsolationLevel.Serializable;
const serializeAuditValue = (value: unknown) => JSON.stringify(value);
const auditValue = (value: unknown) => JSON.parse(serializeAuditValue(value)) as Prisma.InputJsonValue;
const businessDate = (instant: Date) => new Date(`${formatBusinessDate(instant)}T00:00:00.000Z`);

async function invalidate(domain: "attendance" | "payroll", entityType: string, entityId: string) {
  await publishReportInvalidation({ domain, entityType, entityId });
}

export async function saveEmploymentProfile(input: { userId: string; compensationType: CompensationType; dailyRate?: Prisma.Decimal.Value | null; monthlySalary?: Prisma.Decimal.Value | null; effectiveFrom: Date; effectiveTo?: Date | null; status: EmploymentStatus; actorUserId: string }) {
  const dailyRate = input.compensationType === "DAILY" ? money(input.dailyRate ?? 0) : null;
  const monthlySalary = input.compensationType === "MONTHLY" ? money(input.monthlySalary ?? 0) : null;
  if ((dailyRate && dailyRate.lte(0)) || (monthlySalary && monthlySalary.lte(0))) throw new Error("Compensation must be greater than zero.");
  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) throw new Error("Effective end date must be after the start date.");
  const profile = await prisma.$transaction(async (tx) => {
    const { previous, saved } = await tx.employmentProfile.findUnique({ where: { userId: input.userId } }).then(async (previous) => ({
      previous,
      saved: await tx.employmentProfile.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, compensationType: input.compensationType, dailyRate, monthlySalary, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, status: input.status },
        update: { compensationType: input.compensationType, dailyRate, monthlySalary, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, status: input.status },
      }),
    }));
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: previous ? "employment.profile.updated" : "employment.profile.created", entityType: "EmploymentProfile", entityId: saved.id, previousValue: previous ? auditValue(previous) : undefined, newValue: auditValue(saved), relatedEntityType: "User", relatedEntityId: input.userId } });
    return saved;
  });
  await invalidate("payroll", "EmploymentProfile", profile.id);
  return profile;
}

export async function saveAttendancePolicy(input: { shiftMinutes: number; graceMinutes: number; overtimeThresholdMinutes: number; actorUserId: string }) {
  if (input.shiftMinutes < 1 || input.graceMinutes < 0 || input.overtimeThresholdMinutes < 1) throw new Error("Attendance policy values are invalid.");
  const policy = await prisma.$transaction(async (tx) => {
    const { previous, saved } = await tx.attendancePolicy.findUnique({ where: { id: "default" } }).then(async (previous) => ({
      previous,
      saved: await tx.attendancePolicy.upsert({ where: { id: "default" }, create: { id: "default", shiftMinutes: input.shiftMinutes, graceMinutes: input.graceMinutes, overtimeThresholdMinutes: input.overtimeThresholdMinutes }, update: { shiftMinutes: input.shiftMinutes, graceMinutes: input.graceMinutes, overtimeThresholdMinutes: input.overtimeThresholdMinutes } }),
    }));
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "attendance.policy.updated", entityType: "AttendancePolicy", entityId: saved.id, previousValue: previous ? auditValue(previous) : undefined, newValue: auditValue(saved) } });
    return saved;
  });
  await invalidate("attendance", "AttendancePolicy", policy.id);
  return policy;
}

export async function createScheduledShift(input: { workerId: string; startsAt: Date; endsAt: Date; station?: Station | null; actorUserId: string }) {
  if (input.endsAt <= input.startsAt) throw new Error("Shift end must be after shift start.");
  const shift = await prisma.$transaction(async (tx) => {
    const overlap = await tx.scheduledShift.findFirst({ where: { workerId: input.workerId, status: "SCHEDULED", startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } }, select: { id: true } });
    if (overlap) throw new Error("This worker already has an overlapping shift.");
    const created = await tx.scheduledShift.create({ data: { workerId: input.workerId, startsAt: input.startsAt, endsAt: input.endsAt, station: input.station ?? null, createdByUserId: input.actorUserId } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "attendance.shift.created", entityType: "ScheduledShift", entityId: created.id, newValue: auditValue(created), relatedEntityType: "User", relatedEntityId: input.workerId } });
    return created;
  }, { isolationLevel: SERIALIZABLE });
  await invalidate("attendance", "ScheduledShift", shift.id);
  return shift;
}

export async function cancelScheduledShift(input: { shiftId: string; actorUserId: string; reason: string }) {
  const shift = await prisma.$transaction(async (tx) => {
    const previous = await tx.scheduledShift.findUnique({ where: { id: input.shiftId } });
    if (!previous || previous.status !== "SCHEDULED") throw new Error("Open scheduled shift not found.");
    const updated = await tx.scheduledShift.update({ where: { id: previous.id }, data: { status: "CANCELLED" } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "attendance.shift.cancelled", entityType: "ScheduledShift", entityId: updated.id, reason: input.reason, previousValue: auditValue(previous), newValue: auditValue(updated) } });
    return updated;
  });
  await invalidate("attendance", "ScheduledShift", shift.id);
  return shift;
}

export async function recordClockEvent(input: { workerId: string; type: ClockEventType; note?: string | null }) {
  const event = await prisma.$transaction(async (tx) => {
    const last = await tx.clockEvent.findFirst({ where: { workerId: input.workerId }, orderBy: { occurredAt: "desc" } });
    if (last?.type === input.type) throw new Error(input.type === "IN" ? "You are already clocked in." : "You are already clocked out.");
    const created = await tx.clockEvent.create({ data: { workerId: input.workerId, type: input.type, note: input.note?.trim() || null } });
    await tx.auditLog.create({ data: { actorUserId: input.workerId, action: `attendance.clock.${input.type.toLowerCase()}`, entityType: "ClockEvent", entityId: created.id, newValue: auditValue(created), relatedEntityType: "User", relatedEntityId: input.workerId } });
    return created;
  }, { isolationLevel: SERIALIZABLE });
  await invalidate("attendance", "ClockEvent", event.id);
  return event;
}

export async function approveAttendance(input: { shiftId: string; status: AttendanceStatus; approvedOvertimeMinutes?: number; absenceReason?: string | null; actorUserId: string }) {
  const record = await prisma.$transaction(async (tx) => {
    const shift = await tx.scheduledShift.findUnique({ where: { id: input.shiftId } });
    if (!shift || shift.status === "CANCELLED") throw new Error("Scheduled shift not found.");
    const policy = await tx.attendancePolicy.findUnique({ where: { id: "default" } }) ?? { shiftMinutes: 480, graceMinutes: 10, overtimeThresholdMinutes: 480 };
    const events = await tx.clockEvent.findMany({ where: { workerId: shift.workerId, occurredAt: { gte: new Date(shift.startsAt.getTime() - 6 * 3_600_000), lte: new Date(shift.endsAt.getTime() + 12 * 3_600_000) } }, orderBy: { occurredAt: "asc" } });
    const clockIn = events.find((event) => event.type === "IN")?.occurredAt ?? null;
    const clockOut = events.find((event) => event.type === "OUT" && (!clockIn || event.occurredAt > clockIn))?.occurredAt ?? null;
    const outcome = input.status === "PRESENT" ? attendanceOutcome({ scheduledStart: shift.startsAt, clockIn, clockOut, graceMinutes: policy.graceMinutes, overtimeThresholdMinutes: policy.overtimeThresholdMinutes }) : { workedMinutes: 0, lateMinutes: 0, overtimeMinutes: 0 };
    const approvedOvertimeMinutes = Math.max(0, Math.min(input.approvedOvertimeMinutes ?? outcome.overtimeMinutes, outcome.overtimeMinutes));
    const existing = await tx.attendanceRecord.findFirst({ where: { OR: [{ scheduledShiftId: shift.id }, { workerId: shift.workerId, businessDate: businessDate(shift.startsAt) }] } });
    const data = { workerId: shift.workerId, scheduledShiftId: shift.id, businessDate: businessDate(shift.startsAt), status: input.status, clockInAt: clockIn, clockOutAt: clockOut, workedMinutes: outcome.workedMinutes, lateMinutes: outcome.lateMinutes, approvedOvertimeMinutes, absenceReason: input.status === "ABSENT" ? input.absenceReason?.trim() || "Not recorded" : null, approvedByUserId: input.actorUserId, approvedAt: new Date() };
    const saved = existing ? await tx.attendanceRecord.update({ where: { id: existing.id }, data }) : await tx.attendanceRecord.create({ data });
    await tx.scheduledShift.update({ where: { id: shift.id }, data: { status: "COMPLETED" } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "attendance.record.approved", entityType: "AttendanceRecord", entityId: saved.id, previousValue: existing ? auditValue(existing) : undefined, newValue: auditValue(saved), relatedEntityType: "ScheduledShift", relatedEntityId: shift.id } });
    return saved;
  }, { isolationLevel: SERIALIZABLE });
  await invalidate("attendance", "AttendanceRecord", record.id);
  return record;
}

export async function createPayrollAdjustment(input: { workerId: string; periodStart: Date; periodEnd: Date; type: PayrollAdjustmentType; amount: Prisma.Decimal.Value; reason: string; actorUserId: string }) {
  const amount = money(input.amount);
  if (amount.lte(0) || input.periodEnd < input.periodStart || !input.reason.trim()) throw new Error("Payroll adjustment is invalid.");
  const adjustment = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollAdjustment.create({ data: { workerId: input.workerId, periodStart: input.periodStart, periodEnd: input.periodEnd, type: input.type, amount, reason: input.reason.trim(), createdByUserId: input.actorUserId } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "payroll.adjustment.created", entityType: "PayrollAdjustment", entityId: created.id, reason: created.reason, newValue: auditValue(created), relatedEntityType: "User", relatedEntityId: input.workerId } });
    return created;
  });
  await invalidate("payroll", "PayrollAdjustment", adjustment.id);
  return adjustment;
}

export async function approvePayrollAdjustment(input: { adjustmentId: string; actorUserId: string }) {
  const adjustment = await prisma.$transaction(async (tx) => {
    const previous = await tx.payrollAdjustment.findUnique({ where: { id: input.adjustmentId } });
    if (!previous || previous.approvedAt) throw new Error("Pending payroll adjustment not found.");
    const updated = await tx.payrollAdjustment.update({ where: { id: previous.id }, data: { approvedAt: new Date(), approvedByUserId: input.actorUserId } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "payroll.adjustment.approved", entityType: "PayrollAdjustment", entityId: updated.id, previousValue: auditValue(previous), newValue: auditValue(updated) } });
    return updated;
  });
  await invalidate("payroll", "PayrollAdjustment", adjustment.id);
  return adjustment;
}

export async function createPayrollRun(input: { periodStart: Date; periodEnd: Date; actorUserId: string }) {
  if (input.periodEnd < input.periodStart) throw new Error("Payroll period is invalid.");
  const run = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payroll-finalization'))`;
    const overlapping = await tx.payrollRun.findFirst({ where: { status: "FINALIZED", periodStart: { lte: input.periodEnd }, periodEnd: { gte: input.periodStart } }, select: { id: true } });
    if (overlapping) throw new Error("A finalized payroll already overlaps this period.");
    const [profiles, attendance, adjustments] = await Promise.all([
      tx.employmentProfile.findMany({ where: { status: "ACTIVE", effectiveFrom: { lte: input.periodEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.periodStart } }] }, include: { user: { select: { fullName: true } } } }),
      tx.attendanceRecord.findMany({ where: { businessDate: { gte: input.periodStart, lte: input.periodEnd }, status: "PRESENT", approvedAt: { not: null } } }),
      tx.payrollAdjustment.findMany({ where: { periodStart: { lte: input.periodEnd }, periodEnd: { gte: input.periodStart }, approvedAt: { not: null } } }),
    ]);
    const lines = profiles.map((profile) => {
      const workerAttendance = attendance.filter((row) => row.workerId === profile.userId);
      const workerAdjustments = adjustments.filter((row) => row.workerId === profile.userId);
      const additions = workerAdjustments.filter((row) => ["BONUS", "CORRECTION", "OVERTIME"].includes(row.type)).reduce((sum, row) => sum.plus(row.amount), money(0));
      const deductions = workerAdjustments.filter((row) => ["ADVANCE", "ABSENCE_DEDUCTION"].includes(row.type)).reduce((sum, row) => sum.plus(row.amount), money(0));
      const overtimeMinutes = workerAttendance.reduce((sum, row) => sum + row.approvedOvertimeMinutes, 0);
      const result = calculatePayrollLine({ compensationType: profile.compensationType, dailyRate: profile.dailyRate, monthlySalary: profile.monthlySalary, approvedAttendanceDays: workerAttendance.length, approvedOvertimeMinutes: overtimeMinutes, additions, deductions });
      return { workerId: profile.userId, compensationType: profile.compensationType, basePay: result.basePay, overtimePay: result.overtimePay, additions: result.additions, deductions: result.deductions, netPay: result.netPay, attendanceDays: workerAttendance.length, overtimeMinutes, snapshot: { employee: profile.user.fullName, dailyRate: profile.dailyRate?.toFixed(2) ?? null, monthlySalary: profile.monthlySalary?.toFixed(2) ?? null, adjustmentIds: workerAdjustments.map((row) => row.id) } };
    });
    const created = await tx.payrollRun.create({ data: { periodStart: input.periodStart, periodEnd: input.periodEnd, createdByUserId: input.actorUserId, lines: { create: lines } }, include: { lines: true } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: "payroll.run.created", entityType: "PayrollRun", entityId: created.id, newValue: auditValue({ periodStart: created.periodStart, periodEnd: created.periodEnd, lineCount: created.lines.length }) } });
    return created;
  }, { isolationLevel: SERIALIZABLE });
  await invalidate("payroll", "PayrollRun", run.id);
  return run;
}

export async function transitionPayrollRun(input: { runId: string; action: "APPROVE" | "FINALIZE" | "VOID"; actorUserId: string; reason?: string }) {
  const run = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payroll-finalization'))`;
    const previous = await tx.payrollRun.findUnique({ where: { id: input.runId } });
    if (!previous) throw new Error("Payroll run not found.");
    if (input.action === "APPROVE" && previous.status !== "DRAFT") throw new Error("Only a draft payroll can be approved.");
    if (input.action === "FINALIZE" && previous.status !== "APPROVED") throw new Error("Only an approved payroll can be finalized.");
    if (input.action === "VOID" && previous.status === "VOIDED") throw new Error("Payroll is already voided.");
    if (input.action === "FINALIZE") {
      const overlap = await tx.payrollRun.findFirst({ where: { id: { not: previous.id }, status: "FINALIZED", periodStart: { lte: previous.periodEnd }, periodEnd: { gte: previous.periodStart } }, select: { id: true } });
      if (overlap) throw new Error("Another finalized payroll overlaps this period.");
    }
    const updated = await tx.payrollRun.update({ where: { id: previous.id }, data: input.action === "APPROVE" ? { status: "APPROVED", approvedAt: new Date(), approvedByUserId: input.actorUserId } : input.action === "FINALIZE" ? { status: "FINALIZED", finalizedAt: new Date(), finalizedByUserId: input.actorUserId } : { status: "VOIDED", voidedAt: new Date(), voidReason: input.reason?.trim() || "Voided by administrator" } });
    await tx.auditLog.create({ data: { actorUserId: input.actorUserId, action: `payroll.run.${input.action.toLowerCase()}`, entityType: "PayrollRun", entityId: updated.id, reason: input.reason, previousValue: auditValue(previous), newValue: auditValue(updated) } });
    return updated;
  }, { isolationLevel: SERIALIZABLE });
  await invalidate("payroll", "PayrollRun", run.id);
  return run;
}
