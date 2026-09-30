"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseProductAvailabilityInput } from "@/lib/menu/product-availability";
import { prisma } from "@/lib/prisma";

export async function updateProductAvailabilityAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) redirect("/admin/menu-availability?availabilityStatus=invalid");

  let availability;
  try {
    availability = parseProductAvailabilityInput({
      mode: formData.get("mode"),
      start: formData.get("start"),
      end: formData.get("end"),
    });
  } catch {
    redirect("/admin/menu-availability?availabilityStatus=invalid");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          availabilityStartMinute: true,
          availabilityEndMinute: true,
        },
      });
      if (!product) throw new Error("Product not found.");

      await tx.product.update({ where: { id: product.id }, data: availability });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "PRODUCT_AVAILABILITY_UPDATED",
          entityType: "Product",
          entityId: product.id,
          previousValue: {
            availabilityStartMinute: product.availabilityStartMinute,
            availabilityEndMinute: product.availabilityEndMinute,
          },
          newValue: availability,
        },
      });
    });
  } catch (error) {
    console.error("Failed to update product availability:", error);
    redirect("/admin/menu-availability?availabilityStatus=failed");
  }

  revalidatePath("/admin/menu-availability");
  revalidatePath("/menu");
  revalidatePath("/api/GET/Product/all");
  revalidatePath("/api/GET/Product");
  redirect("/admin/menu-availability?availabilityStatus=updated");
}
