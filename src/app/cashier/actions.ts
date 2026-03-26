"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/requireRole";
import { getCashierBusinessDayRange } from "@/lib/cashier-business-day";
import {
  closeWaiterBusinessDayShift,
  openWaiterBusinessDayShift,
  reopenWaiterBusinessDayShift,
} from "@/lib/waiter-shifts";

function buildReturnPath(
  waiterId: string,
  balanceStatus: string,
) {
  const params = new URLSearchParams();

  if (waiterId) {
    params.set("waiterId", waiterId);
  }

  if (balanceStatus) {
    params.set("balanceStatus", balanceStatus);
  }

  return params.size > 0 ? `/cashier?${params.toString()}` : "/cashier";
}

function parseAmount(value: FormDataEntryValue | null) {
  const parsedAmount = Number(String(value ?? "").trim());

  return Number.isFinite(parsedAmount) ? parsedAmount : null;
}

function refreshCashierAndWaiterViews() {
  revalidatePath("/cashier");
  revalidatePath("/cashier/reports");
  revalidatePath("/cashier/waiter-orders");
  revalidatePath("/admin/reports");
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
}

export async function saveWaiterOpeningBalance(formData: FormData) {
  await requireRole(["CASHIER", "ADMIN"]);

  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const openingAmount = parseAmount(formData.get("openingAmount")) ?? 0;

  if (!waiterId) {
    redirect(buildReturnPath(waiterId, "invalid_opening_amount"));
  }

  let balanceStatus = "opening_saved";

  try {
    const result = await openWaiterBusinessDayShift(waiterId, openingAmount);

    refreshCashierAndWaiterViews();
    balanceStatus =
      result.mode === "created" ? "opening_saved" : "opening_updated";
  } catch (error) {
    console.error("Failed to save opening balance:", error);
    balanceStatus =
      error instanceof Error
        ? error.message.includes("already been closed today")
          ? "shift_already_closed"
          : error.message.includes("Waiter not found")
            ? "waiter_not_found"
            : "opening_failed"
        : "opening_failed";
  }

  redirect(buildReturnPath(waiterId, balanceStatus));
}

export async function closeWaiterBalanceFromCashier(formData: FormData) {
  await requireRole(["CASHIER", "ADMIN"]);

  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const closingAmount = parseAmount(formData.get("closingAmount"));

  if (!waiterId || closingAmount == null) {
    redirect(buildReturnPath(waiterId, "invalid_closing_amount"));
  }

  let balanceStatus = "closing_saved";

  try {
    await closeWaiterBusinessDayShift(waiterId, closingAmount);

    refreshCashierAndWaiterViews();
  } catch (error) {
    console.error("Failed to save closing balance:", error);
    balanceStatus =
      error instanceof Error &&
      error.message.includes("There is no open balance")
        ? "no_open_shift"
        : "closing_failed";
  }

  redirect(buildReturnPath(waiterId, balanceStatus));
}

export async function reopenWaiterBalanceFromCashier(formData: FormData) {
  await requireRole(["CASHIER", "ADMIN"]);

  const waiterId = String(formData.get("waiterId") ?? "").trim();

  if (!waiterId) {
    redirect(buildReturnPath(waiterId, "reopen_failed"));
  }

  let balanceStatus = "reopened_saved";

  try {
    await reopenWaiterBusinessDayShift(waiterId);

    refreshCashierAndWaiterViews();
  } catch (error) {
    console.error("Failed to reopen closing balance:", error);
    balanceStatus =
      error instanceof Error &&
      error.message.includes("There is no closed balance")
        ? "no_closed_shift"
        : "reopen_failed";
  }

  redirect(buildReturnPath(waiterId, balanceStatus));
}

export async function resetWaiterShiftTestData() {
  await requireRole(["CASHIER", "ADMIN"]);

  const { start, end } = getCashierBusinessDayRange();

  await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: {
        waiterId: {
          not: null,
        },
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        id: true,
      },
    });

    const orderIds = orders.map((order) => order.id);

    if (orderIds.length > 0) {
      const orderItems = await tx.orderItem.findMany({
        where: {
          orderId: {
            in: orderIds,
          },
        },
        select: {
          id: true,
        },
      });

      const orderItemIds = orderItems.map((item) => item.id);

      if (orderItemIds.length > 0) {
        await tx.orderItemModifier.deleteMany({
          where: {
            orderItemId: {
              in: orderItemIds,
            },
          },
        });
      }

      await tx.orderItem.deleteMany({
        where: {
          orderId: {
            in: orderIds,
          },
        },
      });

      await tx.payment.deleteMany({
        where: {
          orderId: {
            in: orderIds,
          },
        },
      });

      await tx.order.deleteMany({
        where: {
          id: {
            in: orderIds,
          },
        },
      });
    }

    await tx.shift.deleteMany({
      where: {
        waiter: {
          role: "WAITER",
        },
        openedAt: {
          gte: start,
          lt: end,
        },
      },
    });
  });

  refreshCashierAndWaiterViews();
  redirect("/cashier?balanceStatus=reset_test_data");
}
