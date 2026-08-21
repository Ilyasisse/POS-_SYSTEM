"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { recordClockEvent } from "@/lib/staff/staff-operations";

export async function recordOwnClockAction(formData: FormData) {
  const worker = await requirePermission(PERMISSIONS.ATTENDANCE_RECORD);
  await recordClockEvent({
    workerId: worker.id,
    type: z.enum(["IN", "OUT"]).parse(formData.get("type")),
    note: z.string().trim().max(250).parse(String(formData.get("note") ?? "")) || null,
  });
  revalidatePath("/staff/attendance");
  revalidatePath("/admin/staff/attendance");
}
