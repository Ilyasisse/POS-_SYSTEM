"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  approveAttendance,
  approvePayrollAdjustment,
  cancelScheduledShift,
  createPayrollAdjustment,
  createPayrollRun,
  createScheduledShift,
  saveAttendancePolicy,
  saveEmploymentProfile,
  transitionPayrollRun,
} from "@/lib/staff/staff-operations";

const id = z.string().min(1);
const optionalDate = (value: FormDataEntryValue | null) => value ? z.coerce.date().parse(value) : null;
const optionalMoney = (value: FormDataEntryValue | null) => value ? z.coerce.number().positive().parse(value) : null;
const refresh = () => {
  revalidatePath("/admin/staff");
  revalidatePath("/admin/staff/employment");
  revalidatePath("/admin/staff/schedules");
  revalidatePath("/admin/staff/attendance");
  revalidatePath("/admin/staff/payroll");
};

export async function saveEmploymentAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.EMPLOYMENT_MANAGE);
  const compensationType = z.enum(["DAILY", "MONTHLY"]).parse(formData.get("compensationType"));
  await saveEmploymentProfile({
    userId: id.parse(formData.get("userId")),
    compensationType,
    dailyRate: compensationType === "DAILY" ? optionalMoney(formData.get("dailyRate")) : null,
    monthlySalary: compensationType === "MONTHLY" ? optionalMoney(formData.get("monthlySalary")) : null,
    effectiveFrom: z.coerce.date().parse(formData.get("effectiveFrom")),
    effectiveTo: optionalDate(formData.get("effectiveTo")),
    status: z.enum(["ACTIVE", "SUSPENDED", "ENDED"]).parse(formData.get("status")),
    actorUserId: actor.id,
  });
  refresh();
}

export async function saveAttendancePolicyAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ATTENDANCE_APPROVE);
  await saveAttendancePolicy({
    shiftMinutes: z.coerce.number().int().min(60).max(1440).parse(formData.get("shiftMinutes")),
    graceMinutes: z.coerce.number().int().min(0).max(120).parse(formData.get("graceMinutes")),
    overtimeThresholdMinutes: z.coerce.number().int().min(0).max(480).parse(formData.get("overtimeThresholdMinutes")),
    actorUserId: actor.id,
  });
  refresh();
}

export async function createScheduleAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ATTENDANCE_SCHEDULE);
  await createScheduledShift({
    workerId: id.parse(formData.get("workerId")),
    startsAt: z.coerce.date().parse(formData.get("startsAt")),
    endsAt: z.coerce.date().parse(formData.get("endsAt")),
    station: z.enum(["CUNTO_SOOMAALI", "FAST_FOOD", "BARISTA", "CABITAAN"]).nullable().parse(formData.get("station") || null),
    actorUserId: actor.id,
  });
  refresh();
}

export async function cancelScheduleAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ATTENDANCE_SCHEDULE);
  await cancelScheduledShift({ shiftId: id.parse(formData.get("shiftId")), actorUserId: actor.id, reason: z.string().trim().min(3).max(250).parse(formData.get("reason") ?? "Cancelled by schedule manager") });
  refresh();
}

export async function approveAttendanceAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ATTENDANCE_APPROVE);
  await approveAttendance({
    shiftId: id.parse(formData.get("shiftId")),
    status: z.enum(["PRESENT", "ABSENT", "REJECTED"]).parse(formData.get("status")),
    approvedOvertimeMinutes: z.coerce.number().int().min(0).max(1440).parse(formData.get("approvedOvertimeMinutes") || 0),
    absenceReason: String(formData.get("absenceReason") ?? "").trim() || null,
    actorUserId: actor.id,
  });
  refresh();
}

export async function createPayrollAdjustmentAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  await createPayrollAdjustment({
    workerId: id.parse(formData.get("workerId")),
    periodStart: z.coerce.date().parse(formData.get("periodStart")),
    periodEnd: z.coerce.date().parse(formData.get("periodEnd")),
    type: z.enum(["BONUS", "ADVANCE", "ABSENCE_DEDUCTION", "CORRECTION", "OVERTIME"]).parse(formData.get("type")),
    amount: z.coerce.number().positive().parse(formData.get("amount")),
    reason: z.string().trim().min(3).max(500).parse(formData.get("reason")),
    actorUserId: actor.id,
  });
  refresh();
}

export async function approvePayrollAdjustmentAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  await approvePayrollAdjustment({ adjustmentId: id.parse(formData.get("adjustmentId")), actorUserId: actor.id });
  refresh();
}

export async function createPayrollRunAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  await createPayrollRun({ periodStart: z.coerce.date().parse(formData.get("periodStart")), periodEnd: z.coerce.date().parse(formData.get("periodEnd")), actorUserId: actor.id });
  refresh();
}

export async function transitionPayrollRunAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  await transitionPayrollRun({
    runId: id.parse(formData.get("runId")),
    action: z.enum(["APPROVE", "FINALIZE", "VOID"]).parse(formData.get("action")),
    reason: String(formData.get("reason") ?? "").trim() || undefined,
    actorUserId: actor.id,
  });
  refresh();
}
