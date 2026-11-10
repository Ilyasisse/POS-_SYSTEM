"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { sendInventoryAlerts, setSupplyInventoryLevel } from "@/lib/inventory/inventory";
import { prisma } from "@/lib/prisma";
import { positiveDecimalQuantity } from "@/lib/inventory/inventory-domain";
import { getPostHogClient } from "@/lib/posthog-server";

type TakeSupplyResult =
  | { ok: true; email: "sent" | "failed" | "skipped" | "none" }
  | { ok: false; error: string; field?: "quantity" };

function getString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function takeSupplyInventory(formData: FormData): Promise<TakeSupplyResult> {
  const user = await requirePermission(PERMISSIONS.INVENTORY_MANAGE, {
    stations: ["CABITAAN"],
  });
  const supplyId = getString(formData, "supplyId");
  const note = getString(formData, "note");

  if (!supplyId) {
    return { ok: false, error: "Select a supply first." };
  }

  let quantity;
  try {
    quantity = positiveDecimalQuantity(getString(formData, "quantity"));
  } catch {
    return {
      ok: false,
      field: "quantity",
      error: "Enter a quantity greater than zero.",
    };
  }

  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const supply = await tx.inventorySupply.findUnique({
          where: { id: supplyId },
          select: {
            stockQty: true,
            lowStockThreshold: true,
            isActive: true,
            canonicalUnit: true,
          },
        });

        if (!supply?.isActive) {
          return { ok: false, error: "This supply is no longer available." } as const;
        }
        if (!supply.canonicalUnit) {
          return { ok: false, error: "Ask an admin to configure the supply's unit." } as const;
        }
        if (quantity.gt(supply.stockQty)) {
          return {
            ok: false,
            field: "quantity",
            error: "Only " + supply.stockQty.toString() + " is currently in stock.",
          } as const;
        }

        return {
          ok: true as const,
          alerts: await setSupplyInventoryLevel(
            tx,
            supplyId,
            supply.stockQty.sub(quantity),
            supply.lowStockThreshold,
            "TAKEN",
            note || "Taken from inventory page",
            user.id,
          ),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  } catch (error) {
    console.error("Failed to record supply withdrawal:", error);
    return { ok: false, error: "Could not record the withdrawal. Try again." };
  }

  if (!result.ok) return result;

  revalidatePath("/inventory");
  revalidatePath("/admin/inventory");

  const email = await sendInventoryAlerts(result.alerts).catch((error) => {
    console.error("Failed to send inventory alert:", error);
    return null;
  });

  try {
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: user.id,
        event: "inventory_taken",
        properties: {
          supply_id: supplyId,
          quantity: quantity.toNumber(),
          staff_role: user.role,
        },
      });
      await posthog.flush();
    }
  } catch (error) {
    console.error("Failed to track supply withdrawal:", error);
  }

  if (!email) return { ok: true, email: "failed" };
  if (email.attempted === 0) return { ok: true, email: "none" };
  if (email.sent > 0) return { ok: true, email: "sent" };
  return { ok: true, email: email.skipped ? "skipped" : "failed" };
}
