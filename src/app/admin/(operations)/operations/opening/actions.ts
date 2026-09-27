"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  OpeningReadinessError,
  setOpeningReadinessTask,
  signOffOpeningReadiness,
  startOpeningReadiness,
} from "@/lib/operations/opening-readiness";

const pagePath = "/admin/operations/opening";

async function perform(action: () => Promise<unknown>) {
  let result = "saved";
  try {
    await action();
  } catch (error) {
    if (
      error instanceof OpeningReadinessError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002")
    ) {
      result = "stale";
    } else {
      console.error("Opening checklist update failed:", error);
      result = "failed";
    }
  }
  revalidatePath(pagePath);
  redirect(`${pagePath}?result=${result}`);
}

export async function startOpeningAction() {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  await perform(() => startOpeningReadiness(user.id));
}

export async function setOpeningTaskAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const key = String(formData.get("key") ?? "").trim();
  const checked = formData.get("checked") === "true";
  await perform(() =>
    setOpeningReadinessTask({ key, checked, actorUserId: user.id }),
  );
}

export async function signOffOpeningAction() {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  await perform(() => signOffOpeningReadiness(user.id));
}
