import "server-only";

import { prisma } from "@/lib/prisma";
import {
  complaintAssignmentInput,
  complaintInput,
  complaintResolutionInput,
} from "./complaint-input";

export async function createComplaint(input: unknown, actorUserId: string) {
  const value = complaintInput.parse(input);
  return prisma.$transaction(async (tx) => {
    if (value.orderId) {
      const order = await tx.order.findUnique({
        where: { id: value.orderId },
        select: { id: true },
      });
      if (!order) throw new Error("Order not found.");
    }
    const complaint = await tx.complaintCase.create({
      data: {
        category: value.category,
        priority: value.priority,
        description: value.description,
        orderId: value.orderId,
        createdByUserId: actorUserId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "complaint.created",
        entityType: "ComplaintCase",
        entityId: complaint.id,
        newValue: {
          category: value.category,
          priority: value.priority,
          orderId: value.orderId,
        },
      },
    });
    return complaint;
  });
}

export async function assignComplaint(input: unknown, actorUserId: string) {
  const value = complaintAssignmentInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const [current, assignee] = await Promise.all([
      tx.complaintCase.findUnique({ where: { id: value.complaintId } }),
      tx.staff.findFirst({
        where: { id: value.assigneeId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!assignee) throw new Error("Select an active staff member.");
    if (!current || !["OPEN", "IN_PROGRESS"].includes(current.status))
      throw new Error("Only open complaints can be assigned.");
    if (
      current.assignedToUserId === assignee.id &&
      current.status === "IN_PROGRESS"
    )
      return;
    const claimed = await tx.complaintCase.updateMany({
      where: {
        id: value.complaintId,
        status: current.status,
        assignedToUserId: current.assignedToUserId,
      },
      data: { assignedToUserId: assignee.id, status: "IN_PROGRESS" },
    });
    if (claimed.count !== 1)
      throw new Error("Complaint changed. Refresh and try again.");
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "complaint.assigned",
        entityType: "ComplaintCase",
        entityId: value.complaintId,
        previousValue: {
          assigneeId: current.assignedToUserId,
          status: current.status,
        },
        newValue: { assigneeId: assignee.id, status: "IN_PROGRESS" },
      },
    });
  });
}

export async function resolveComplaintCase(
  input: unknown,
  actorUserId: string,
) {
  const value = complaintResolutionInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const resolvedAt = new Date();
    const claimed = await tx.complaintCase.updateMany({
      where: { id: value.complaintId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: {
        status: "RESOLVED",
        resolutionNotes: value.resolutionNotes,
        resolvedAt,
        resolvedByUserId: actorUserId,
      },
    });
    if (claimed.count !== 1)
      throw new Error("Only open complaints can be resolved.");
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "complaint.resolved",
        entityType: "ComplaintCase",
        entityId: value.complaintId,
        newValue: { status: "RESOLVED", resolvedAt: resolvedAt.toISOString() },
      },
    });
  });
}
