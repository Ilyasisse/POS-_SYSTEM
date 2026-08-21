import "server-only";

import {
  CleaningRunStatus,
  Prisma,
  type IncidentSeverity,
  type KitchenQualityEventType,
  type OperationalIncidentType,
  type Station,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canCompleteCleaningRun } from "@/lib/kitchen/kitchen-metrics";

const SERIALIZABLE = Prisma.TransactionIsolationLevel.Serializable;

function requiredText(value: string, label: string, maximum = 1000) {
  const result = value.trim();
  if (result.length < 3) throw new Error(`${label} must be at least 3 characters.`);
  if (result.length > maximum) throw new Error(`${label} is too long.`);
  return result;
}

export async function saveKitchenPreparationTarget(input: {
  station: Station;
  targetMinutes: number;
  actorUserId: string;
}) {
  if (!Number.isInteger(input.targetMinutes) || input.targetMinutes < 1 || input.targetMinutes > 240) {
    throw new Error("Preparation target must be between 1 and 240 minutes.");
  }
  return prisma.$transaction(async (tx) => {
    const { previous, target } = await tx.kitchenPreparationTarget
      .findUnique({ where: { station: input.station } })
      .then(async (previous) => ({
        previous,
        target: await tx.kitchenPreparationTarget.upsert({
          where: { station: input.station },
          create: { station: input.station, targetMinutes: input.targetMinutes, updatedByUserId: input.actorUserId },
          update: { targetMinutes: input.targetMinutes, updatedByUserId: input.actorUserId },
        }),
      }));
    await tx.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      action: "kitchen.preparation_target.changed",
      entityType: "KitchenPreparationTarget",
      entityId: target.id,
      previousValue: previous ? { targetMinutes: previous.targetMinutes } : Prisma.JsonNull,
      newValue: { station: input.station, targetMinutes: input.targetMinutes },
    } });
    return target;
  });
}

export async function recordKitchenQualityEvent(input: {
  orderId: string;
  orderItemId?: string | null;
  station?: Station | null;
  type: KitchenQualityEventType;
  reason: string;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.kitchenTicketState.findUnique({
      where: { orderId: input.orderId },
      include: { order: { select: { orderItems: { select: { id: true, station: true } } } } },
    });
    if (!ticket) throw new Error("Kitchen ticket not found.");
    const line = input.orderItemId
      ? ticket.order.orderItems.find((item) => item.id === input.orderItemId)
      : null;
    if (input.orderItemId && !line) throw new Error("Order item does not belong to this ticket.");
    return tx.kitchenQualityEvent.create({
      data: {
        orderId: input.orderId,
        orderItemId: input.orderItemId ?? null,
        station: input.station ?? line?.station ?? null,
        type: input.type,
        reason: requiredText(input.reason, "Reason"),
        actorUserId: input.actorUserId,
      },
    });
  });
}

export async function createOperationalIncident(input: {
  type: OperationalIncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  station?: Station | null;
  reportedByUserId: string;
  assignedToUserId?: string | null;
}) {
  return prisma.operationalIncident.create({
    data: {
      type: input.type,
      severity: input.severity,
      title: requiredText(input.title, "Incident title", 160),
      description: requiredText(input.description, "Incident description", 2000),
      station: input.station ?? null,
      reportedByUserId: input.reportedByUserId,
      assignedToUserId: input.assignedToUserId ?? null,
    },
  });
}

export async function resolveOperationalIncident(input: {
  incidentId: string;
  resolutionNotes: string;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const resolvedAt = new Date();
    const claimed = await tx.operationalIncident.updateMany({
      where: { id: input.incidentId, status: "OPEN" },
      data: {
        status: "RESOLVED",
        resolvedAt,
        resolutionNotes: requiredText(input.resolutionNotes, "Resolution notes", 2000),
      },
    });
    if (claimed.count !== 1) throw new Error("Only an open incident can be resolved.");
    await tx.auditLog.create({ data: {
      actorUserId: input.actorUserId,
      action: "operations.incident.resolved",
      entityType: "OperationalIncident",
      entityId: input.incidentId,
      newValue: { status: "RESOLVED", resolvedAt: resolvedAt.toISOString() },
    } });
    return tx.operationalIncident.findUniqueOrThrow({ where: { id: input.incidentId } });
  });
}

export async function createCleaningTemplate(input: {
  name: string;
  station?: Station | null;
  schedule: string;
  tasks: readonly { label: string; required?: boolean }[];
}) {
  if (!input.tasks.length) throw new Error("A cleaning template needs at least one task.");
  return prisma.cleaningChecklistTemplate.create({
    data: {
      name: requiredText(input.name, "Template name", 160),
      station: input.station ?? null,
      schedule: requiredText(input.schedule, "Schedule", 160),
      tasks: {
        create: input.tasks.map((task, index) => ({
          label: requiredText(task.label, "Task label", 300),
          isRequired: task.required ?? true,
          sortOrder: index,
        })),
      },
    },
    include: { tasks: true },
  });
}

export async function scheduleCleaningRun(input: {
  templateId: string;
  scheduledFor: Date;
  assignedToUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.cleaningChecklistTemplate.findUnique({
      where: { id: input.templateId, isActive: true },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!template) throw new Error("Active cleaning template not found.");
    return tx.cleaningChecklistRun.create({
      data: {
        templateId: template.id,
        station: template.station,
        scheduledFor: input.scheduledFor,
        assignedToUserId: input.assignedToUserId ?? null,
        tasks: { create: template.tasks.map((task) => ({ taskId: task.id })) },
      },
      include: { tasks: true },
    });
  });
}

export async function completeCleaningTask(input: {
  runTaskId: string;
  actorUserId: string;
  evidenceText?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.cleaningChecklistRunTask.findUnique({
      where: { id: input.runTaskId },
      include: { run: { select: { status: true } } },
    });
    if (!task || task.completed) throw new Error("Open cleaning task not found.");
    if (task.run.status !== CleaningRunStatus.PENDING && task.run.status !== CleaningRunStatus.IN_PROGRESS) {
      throw new Error("Cleaning run is not open.");
    }
    const completedAt = new Date();
    const completed = await tx.cleaningChecklistRunTask.update({
      where: { id: task.id },
      data: {
        completed: true,
        completedAt,
        completedByUserId: input.actorUserId,
        evidenceText: input.evidenceText?.trim() || null,
      },
    });
    await tx.cleaningChecklistRun.updateMany({
      where: { id: task.runId, status: CleaningRunStatus.PENDING },
      data: { status: CleaningRunStatus.IN_PROGRESS, startedAt: completedAt },
    });
    return completed;
  });
}

export async function completeCleaningRun(input: {
  runId: string;
  actorUserId: string;
  evidenceNote?: string | null;
  evidenceUrl?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.cleaningChecklistRun.findUnique({
      where: { id: input.runId },
      include: { tasks: { include: { task: true } } },
    });
    if (!run || run.status === "COMPLETED") throw new Error("Open cleaning run not found.");
    if (!canCompleteCleaningRun(run.tasks.map((line) => ({
      isRequired: line.task.isRequired,
      completed: line.completed,
    })))) {
      throw new Error("Complete every required cleaning task first.");
    }
    return tx.cleaningChecklistRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedByUserId: input.actorUserId,
        evidenceNote: input.evidenceNote?.trim() || null,
        evidenceUrl: input.evidenceUrl?.trim() || null,
      },
    });
  }, { isolationLevel: SERIALIZABLE });
}
