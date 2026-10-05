"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { availabilityRestorationTime } from "@/lib/products/availability";

const ALLOWED_DURATIONS = new Set([60, 180, 720, 1440]);

export async function setProductAvailability(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = String(formData.get("id") || "").trim();
  const mode = String(formData.get("mode") || "").trim();
  if (!id || (mode !== "AVAILABLE" && mode !== "UNAVAILABLE")) {
    throw new Error("Product availability request is invalid.");
  }

  const reason = String(formData.get("reason") || "").trim();
  const rawDuration = String(formData.get("durationMinutes") || "").trim();
  const durationMinutes = rawDuration ? Number(rawDuration) : null;
  if (
    mode === "UNAVAILABLE" &&
    (reason.length < 3 ||
      (durationMinutes !== null && !ALLOWED_DURATIONS.has(durationMinutes)))
  ) {
    throw new Error("Choose a valid duration and provide a short reason.");
  }

  await prisma.$transaction(async (tx) => {
    const previous = await tx.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        availableForSale: true,
        availabilityRestoresAt: true,
        availabilityReason: true,
      },
    });
    if (!previous) throw new Error("Product not found.");

    const availableForSale = mode === "AVAILABLE";
    const availabilityRestoresAt = availableForSale
      ? null
      : availabilityRestorationTime(durationMinutes);
    const availabilityReason = availableForSale ? null : reason;
    await tx.product.update({
      where: { id },
      data: {
        availableForSale,
        availabilityRestoresAt,
        availabilityReason,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: availableForSale
          ? "product.availability.restored"
          : "product.availability.paused",
        entityType: "Product",
        entityId: id,
        reason: availableForSale ? "Restored for sale" : reason,
        previousValue: {
          availableForSale: previous.availableForSale,
          availabilityRestoresAt:
            previous.availabilityRestoresAt?.toISOString() ?? null,
          availabilityReason: previous.availabilityReason,
        },
        newValue: {
          availableForSale,
          availabilityRestoresAt: availabilityRestoresAt?.toISOString() ?? null,
          availabilityReason,
        },
      },
    });
  });

  revalidatePath("/admin/products");
  revalidatePath("/menu");
  revalidatePath("/api/GET/Product");
  revalidatePath("/api/GET/Product/all");
}

export async function createProduct(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const trackStock = formData.get("trackStock") === "on";
  const categoryId = String(formData.get("categoryId") || "").trim();
  const pronunciationAudioUrl = String(
    formData.get("pronunciationAudioUrl") || "",
  ).trim();

  if (!name) {
    throw new Error("Product name is required.");
  }

  if (Number.isNaN(price) || price < 0) {
    throw new Error("Price must be a valid number.");
  }

  if (!categoryId) {
    throw new Error("Category is required.");
  }

  await prisma.product.create({
    data: {
      name,
      price,
      trackStock,
      pronunciationAudioUrl: pronunciationAudioUrl || null,
      category: {
        connect: { id: categoryId },
      },
    },
  });

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProduct(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const trackStock = formData.get("trackStock") === "on";
  const categoryId = String(formData.get("categoryId") || "").trim();
  const pronunciationAudioUrl = String(
    formData.get("pronunciationAudioUrl") || "",
  ).trim();

  if (!id) {
    throw new Error("Product id is required.");
  }

  if (!name) {
    throw new Error("Product name is required.");
  }

  if (Number.isNaN(price) || price < 0) {
    throw new Error("Price must be a valid number.");
  }

  if (!categoryId) {
    throw new Error("Category is required.");
  }

  await prisma.product.update({
    where: { id },
    data: {
      name,
      price,
      trackStock,
      pronunciationAudioUrl: pronunciationAudioUrl || null,
      category: {
        connect: { id: categoryId },
      },
    },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products`);
  redirect(`/admin/products`);
}

export async function deleteProduct(formData: FormData) {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const id = String(formData.get("id") || "").trim();

  if (!id) {
    throw new Error("Product id is required.");
  }

  await prisma.product.delete({
    where: { id },
  });

  revalidatePath("/admin/products");
  redirect("/admin/products");
}
