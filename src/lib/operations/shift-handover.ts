import "server-only";

import { prisma } from "@/lib/prisma";
import {
  HandoverValidationError,
  parseHandoverDraft,
  requiredHandoverText,
} from "@/lib/operations/shift-handover-rules";

export async function createShiftHandover(input: {
  title: unknown;
  details: unknown;
  requestToken: unknown;
  actorUserId: string;
}) {
  const draft = parseHandoverDraft(input);
  return prisma.$transaction(async (tx) => {
    const note = await tx.shiftHandoverNote.create({
      data: { ...draft, createdByUserId: input.actorUserId },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "operations.handover.created",
        entityType: "ShiftHandoverNote",
        entityId: note.id,
        newValue: { title: note.title },
      },
    });
    return note;
  });
}

export async function resolveShiftHandover(input: {
  id: string;
  resolutionNote: unknown;
  actorUserId: string;
}) {
  const resolutionNote = requiredHandoverText(
    input.resolutionNote,
    "Resolution",
    3,
    1000,
  );
  if (!input.id.trim())
    throw new HandoverValidationError("Select a handover note.");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.shiftHandoverNote.updateMany({
      where: { id: input.id, resolvedAt: null },
      data: {
        resolvedAt: new Date(),
        resolvedByUserId: input.actorUserId,
        resolutionNote,
      },
    });
    if (updated.count !== 1)
      throw new HandoverValidationError("This note is no longer open.");
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "operations.handover.resolved",
        entityType: "ShiftHandoverNote",
        entityId: input.id,
        newValue: { resolutionNote },
      },
    });
  });
}
