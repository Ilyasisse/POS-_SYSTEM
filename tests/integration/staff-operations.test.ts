import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  approveAttendance,
  approvePayrollAdjustment,
  createPayrollAdjustment,
  createPayrollRun,
  recordClockEvent,
  transitionPayrollRun,
} from "../../src/lib/staff/staff-operations";
import {
  completeCleaningRun,
  completeCleaningTask,
  createCleaningTemplate,
  createOperationalIncident,
  resolveOperationalIncident,
  scheduleCleaningRun,
} from "../../src/lib/kitchen/kitchen-operations";
import { prisma } from "../../src/lib/prisma";
import { db, unique, user } from "../workflow/fixtures";
import { formatBusinessDate } from "../../src/lib/reports/reporting-calendar";

after(async () => {
  await Promise.all([db.$disconnect(), prisma.$disconnect()]);
});

test("approved attendance and bonus drive one finalized payroll line", async () => {
  const [worker, admin] = await Promise.all([user("CASHIER"), user("ADMIN")]);
  const date = new Date(`${formatBusinessDate(new Date())}T00:00:00.000Z`);
  const actorUserId = admin.id;
  await db.employmentProfile.create({
    data: { userId: worker.id, compensationType: "DAILY", dailyRate: 20, effectiveFrom: date },
  });
  const shift = await db.scheduledShift.create({
    data: {
      workerId: worker.id,
      startsAt: new Date(date.getTime() + 4 * 3_600_000),
      endsAt: new Date(date.getTime() + 25 * 3_600_000),
      createdByUserId: admin.id,
    },
  });
  const clockIn = await recordClockEvent({ workerId: worker.id, type: "IN" });
  await assert.rejects(recordClockEvent({ workerId: worker.id, type: "IN" }), /already clocked in/);
  const clockOut = await recordClockEvent({ workerId: worker.id, type: "OUT" });
  assert.ok(clockOut.occurredAt >= clockIn.occurredAt);
  // Place the two recorded events inside the same test shift regardless of when CI runs.
  await db.clockEvent.update({ where: { id: clockIn.id }, data: { occurredAt: shift.startsAt } });
  await db.clockEvent.update({
    where: { id: clockOut.id },
    data: { occurredAt: new Date(shift.startsAt.getTime() + 8 * 3_600_000) },
  });
  await approveAttendance({ shiftId: shift.id, status: "PRESENT", actorUserId });
  assert.equal(
    await db.attendanceRecord.count({ where: { workerId: worker.id, status: "PRESENT" } }),
    1,
  );

  const period = { periodStart: date, periodEnd: date };
  const bonus = await createPayrollAdjustment({
    ...period,
    workerId: worker.id,
    type: "BONUS",
    amount: 4,
    reason: "Workflow bonus",
    actorUserId,
  });
  await approvePayrollAdjustment({ adjustmentId: bonus.id, actorUserId });
  const run = await createPayrollRun({ ...period, actorUserId });
  const line = await db.payrollLine.findFirstOrThrow({
    where: { payrollRunId: run.id, workerId: worker.id },
  });
  assert.equal(Number(line.netPay), 24);
  await transitionPayrollRun({ runId: run.id, action: "APPROVE", actorUserId });
  await transitionPayrollRun({ runId: run.id, action: "FINALIZE", actorUserId });
  await assert.rejects(createPayrollRun({ ...period, actorUserId }), /finalized payroll/i);
});

test("cleaning requires all required tasks and resolving an incident audits the actor", async () => {
  const admin = await user("ADMIN");
  const actorUserId = admin.id;
  const template = await createCleaningTemplate({
    name: unique("Test checklist"),
    schedule: "Daily",
    tasks: [{ label: "Sanitize counter" }],
  });
  const run = await scheduleCleaningRun({ templateId: template.id, scheduledFor: new Date() });
  await assert.rejects(completeCleaningRun({ runId: run.id, actorUserId }), /required/i);
  await completeCleaningTask({ runTaskId: run.tasks[0].id, actorUserId });
  await completeCleaningRun({ runId: run.id, actorUserId, evidenceNote: "Test completed" });
  assert.equal(
    (await db.cleaningChecklistRun.findUniqueOrThrow({ where: { id: run.id } })).status,
    "COMPLETED",
  );

  const incident = await createOperationalIncident({
    type: "POS",
    severity: "LOW",
    title: "Test printer issue",
    description: "Synthetic incident",
    reportedByUserId: admin.id,
  });
  const resolved = await resolveOperationalIncident({
    incidentId: incident.id,
    actorUserId,
    resolutionNotes: "Test printer checked",
  });
  assert.equal(resolved.status, "RESOLVED");
  assert.ok(resolved.resolvedAt);
  assert.equal(
    await db.auditLog.count({
      where: { entityId: incident.id, action: "operations.incident.resolved", actorUserId },
    }),
    1,
  );
});
