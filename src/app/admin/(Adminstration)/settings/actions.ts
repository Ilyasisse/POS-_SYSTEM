"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { parseTimeInput } from "@/lib/customer/online-ordering-hours";

function auditValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function saveOnlineOrderingHoursAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const enabled = formData.get("enabled") === "on";
  const startMinute = parseTimeInput(String(formData.get("startTime") ?? ""));
  const endMinute = parseTimeInput(String(formData.get("endTime") ?? ""));

  if (startMinute == null || endMinute == null) {
    redirect("/admin/settings?settingsStatus=invalid_hours#online-ordering");
  }

  await prisma.$transaction(async (tx) => {
    const previous = await tx.cafeSetting.findUnique({
      where: { id: "default" },
    });
    const saved = await tx.cafeSetting.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        onlineOrderingEnabled: enabled,
        onlineOrderStartMinute: startMinute,
        onlineOrderEndMinute: endMinute,
        updatedByUserId: actor.id,
      },
      update: {
        onlineOrderingEnabled: enabled,
        onlineOrderStartMinute: startMinute,
        onlineOrderEndMinute: endMinute,
        updatedByUserId: actor.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "settings.online_ordering.updated",
        entityType: "CafeSetting",
        entityId: saved.id,
        previousValue: previous ? auditValue(previous) : undefined,
        newValue: auditValue(saved),
      },
    });
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?settingsStatus=online_ordering_saved#online-ordering");
}
