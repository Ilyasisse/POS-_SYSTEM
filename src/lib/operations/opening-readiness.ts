import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canSignOffOpeningTasks,
  getOpeningBusinessDate,
  OPENING_READINESS_TASKS,
} from "@/lib/operations/opening-readiness-rules";

export class OpeningReadinessError extends Error {}

export async function startOpeningReadiness(actorUserId: string) {
  const businessDate = getOpeningBusinessDate();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.openingReadinessDay.findUnique({
      where: { businessDate },
    });
    if (existing)
      throw new OpeningReadinessError(
        "Today's checklist has already been started.",
      );
    const day = await tx.openingReadinessDay.create({
      data: {
        businessDate,
        startedByUserId: actorUserId,
        tasks: {
          create: OPENING_READINESS_TASKS.map((task) => ({ ...task })),
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "operations.opening.started",
        entityType: "OpeningReadinessDay",
        entityId: businessDate.toISOString().slice(0, 10),
        newValue: { taskKeys: OPENING_READINESS_TASKS.map((task) => task.key) },
      },
    });
    return day;
  });
}

async function lockDay(tx: Prisma.TransactionClient, businessDate: Date) {
  await tx.$queryRaw<Array<{ businessDate: Date }>>(
    Prisma.sql`SELECT "businessDate" FROM "OpeningReadinessDay" WHERE "businessDate" = ${businessDate} FOR UPDATE`,
  );
  const day = await tx.openingReadinessDay.findUnique({
    where: { businessDate },
    include: { tasks: true },
  });
  if (!day) throw new OpeningReadinessError("Start today's checklist first.");
  if (day.signedAt)
    throw new OpeningReadinessError("Today's checklist is already signed off.");
  return day;
}

export async function setOpeningReadinessTask(input: {
  key: string;
  checked: boolean;
  actorUserId: string;
}) {
  const businessDate = getOpeningBusinessDate();
  return prisma.$transaction(async (tx) => {
    const day = await lockDay(tx, businessDate);
    const task = day.tasks.find((item) => item.key === input.key);
    if (!task) throw new OpeningReadinessError("Unknown opening task.");
    if (Boolean(task.checkedAt) === input.checked) return;
    await tx.openingReadinessTask.update({
      where: { businessDate_key: { businessDate, key: input.key } },
      data: {
        checkedAt: input.checked ? new Date() : null,
        checkedByUserId: input.checked ? input.actorUserId : null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.checked
          ? "operations.opening.task_checked"
          : "operations.opening.task_cleared",
        entityType: "OpeningReadinessTask",
        entityId: `${businessDate.toISOString().slice(0, 10)}:${input.key}`,
        previousValue: { checked: Boolean(task.checkedAt) },
        newValue: { checked: input.checked },
      },
    });
  });
}

export async function signOffOpeningReadiness(actorUserId: string) {
  const businessDate = getOpeningBusinessDate();
  return prisma.$transaction(async (tx) => {
    const day = await lockDay(tx, businessDate);
    if (!canSignOffOpeningTasks(day.tasks)) {
      throw new OpeningReadinessError(
        "Check every opening task before sign-off.",
      );
    }
    const signedAt = new Date();
    await tx.openingReadinessDay.update({
      where: { businessDate },
      data: { signedAt, signedByUserId: actorUserId },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "operations.opening.signed_off",
        entityType: "OpeningReadinessDay",
        entityId: businessDate.toISOString().slice(0, 10),
        newValue: {
          signedAt: signedAt.toISOString(),
          taskCount: day.tasks.length,
        },
      },
    });
  });
}
