"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole as requireAuth } from "@/lib/auth/require-role";

export async function updateAdminProfile(formData: FormData) {
  const currentUser = await requireAuth(["ADMIN", "MANAGER"]);
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();

  if (!fullName) {
    redirect("/admin/profile?profileStatus=invalid_name");
  }

  await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data: {
      fullName,
      phoneNumber: phoneNumber || null,
    },
  });

  revalidatePath("/admin/profile");
  revalidatePath("/admin/dashboard");
  redirect("/admin/profile?profileStatus=updated");
}
