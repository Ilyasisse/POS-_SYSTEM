"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { normalizeKitchenStation } from "@/lib/kitchen/kitchen-socket";
import {
  completeCleaningRun,
  completeCleaningTask,
  createCleaningTemplate,
  createOperationalIncident,
  resolveOperationalIncident,
  saveKitchenPreparationTarget,
  scheduleCleaningRun,
} from "@/lib/kitchen/kitchen-operations";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveKitchenTargetAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.KITCHEN_TARGET_MANAGE);
  const station = normalizeKitchenStation(text(formData, "station"));
  if (!station) throw new Error("Valid kitchen station required.");
  await saveKitchenPreparationTarget({
    station,
    targetMinutes: z.coerce.number().int().min(1).max(240).parse(formData.get("targetMinutes")),
    actorUserId: user.id,
  });
  revalidatePath("/admin/operations");
}

export async function createIncidentAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.OPERATIONS_INCIDENT_RECORD);
  const station = normalizeKitchenStation(text(formData, "station"));
  await createOperationalIncident({
    type: z.enum(["EQUIPMENT", "POS", "INTERNET"]).parse(formData.get("type")),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).parse(formData.get("severity")),
    title: text(formData, "title"),
    description: text(formData, "description"),
    station: station ?? null,
    reportedByUserId: user.id,
    assignedToUserId: text(formData, "assignedToUserId") || null,
  });
  revalidatePath("/admin/operations");
}

export async function resolveIncidentAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.OPERATIONS_INCIDENT_MANAGE);
  await resolveOperationalIncident({
    incidentId: z.string().min(1).parse(formData.get("incidentId")),
    resolutionNotes: text(formData, "resolutionNotes"),
    actorUserId: user.id,
  });
  revalidatePath("/admin/operations");
}

export async function createCleaningTemplateAction(formData: FormData) {
  await requirePermission(PERMISSIONS.CLEANING_MANAGE);
  const tasks = text(formData, "tasks").split(/\r?\n/).map((label) => label.trim()).filter(Boolean);
  await createCleaningTemplate({
    name: text(formData, "name"),
    station: normalizeKitchenStation(text(formData, "station")) ?? null,
    schedule: text(formData, "schedule"),
    tasks: tasks.map((label) => ({ label })),
  });
  revalidatePath("/admin/operations");
}

export async function scheduleCleaningRunAction(formData: FormData) {
  await requirePermission(PERMISSIONS.CLEANING_MANAGE);
  await scheduleCleaningRun({
    templateId: z.string().min(1).parse(formData.get("templateId")),
    scheduledFor: z.coerce.date().parse(formData.get("scheduledFor")),
    assignedToUserId: text(formData, "assignedToUserId") || null,
  });
  revalidatePath("/admin/operations");
}

export async function completeCleaningTaskAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.CLEANING_COMPLETE);
  await completeCleaningTask({
    runTaskId: z.string().min(1).parse(formData.get("runTaskId")),
    actorUserId: user.id,
    evidenceText: text(formData, "evidenceText") || null,
  });
  revalidatePath("/admin/operations");
}

export async function completeCleaningRunAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.CLEANING_COMPLETE);
  await completeCleaningRun({
    runId: z.string().min(1).parse(formData.get("runId")),
    actorUserId: user.id,
    evidenceNote: text(formData, "evidenceNote") || null,
    evidenceUrl: text(formData, "evidenceUrl") || null,
  });
  revalidatePath("/admin/operations");
}
