"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { getCashierBusinessDayRange } from "@/lib/cashier/cashier-business-day";
import {
  CASHIER_DELETED_ORDER_ITEM_COOKIE,
  CASHIER_DELETED_ORDER_ITEM_LIMIT,
  type DeletedOrderItemSnapshot,
  parseDeletedOrderItemSnapshots,
} from "@/lib/cashier/cashier-order-item-undo";

function getReturnPath(waiterId: string) {
  return waiterId
    ? `/manager/waiter-orders?waiterId=${encodeURIComponent(waiterId)}`
    : "/manager/waiter-orders";
}

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function setUndoCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  snapshots: DeletedOrderItemSnapshot[],
) {
  if (snapshots.length === 0) {
    cookieStore.set(CASHIER_DELETED_ORDER_ITEM_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/manager",
      maxAge: 0,
    });
    return;
  }

  cookieStore.set(
    CASHIER_DELETED_ORDER_ITEM_COOKIE,
    JSON.stringify(snapshots.slice(0, CASHIER_DELETED_ORDER_ITEM_LIMIT)),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/manager",
      maxAge: 60 * 15,
    },
  );
}

function filterSnapshotsByUndoId(
  snapshots: DeletedOrderItemSnapshot[],
  undoId: string,
) {
  return snapshots.filter((snapshot) => snapshot.undoId !== undoId);
}

function revalidateCashierViews() {
  revalidatePath("/cashier");
  revalidatePath("/manager");
  revalidatePath("/manager/waiter-orders");
}

export async function deleteWaiterOrderItem(formData: FormData) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);

  const orderId = String(formData.get("orderId") ?? "").trim();
  const orderItemId = String(formData.get("orderItemId") ?? "").trim();
  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const returnPath = getReturnPath(waiterId);

  if (!orderId || !orderItemId) {
    redirect(returnPath);
  }

  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(waiterId ? { waiterId } : {}),
      createdAt: {
        gte: businessDayStart,
        lt: businessDayEnd,
      },
    },
    select: {
      id: true,
      orderNumber: true,
      type: true,
      status: true,
      tableId: true,
      cashierId: true,
      waiterId: true,
      notes: true,
      total: true,
      createdAt: true,
      closedAt: true,
      waiter: {
        select: {
          fullName: true,
        },
      },
      payments: {
        select: {
          id: true,
          cashierId: true,
          cashierName: true,
          method: true,
          amountPaid: true,
          reference: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      orderItems: {
        select: {
          id: true,
          productId: true,
          productName: true,
          qty: true,
          unitPrice: true,
          lineTotal: true,
          unitCostSnapshot: true,
          costSnapshotSource: true,
          recipeVersionId: true,
          createdAt: true,
          assignedUserId: true,
          station: true,
          modifiers: {
            select: {
              id: true,
              modifierId: true,
              modifierName: true,
              qty: true,
              price: true,
            },
            orderBy: {
              id: "asc",
            },
          },
        },
      },
    },
  });

  if (!order || !order.waiterId) {
    redirect(returnPath);
  }

  const selectedItem = order.orderItems.find((item) => item.id === orderItemId);

  if (!selectedItem) {
    redirect(returnPath);
  }

  const deletedUnitPrice = Number(selectedItem.unitPrice);
  const nextItemQuantity = selectedItem.qty - 1;
  const nextItemLineTotal = deletedUnitPrice * nextItemQuantity;

  const undoSnapshot: DeletedOrderItemSnapshot = {
    undoId: crypto.randomUUID(),
    deletedAt: new Date().toISOString(),
    waiterId: order.waiterId,
    waiterName: order.waiter?.fullName ?? null,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      tableId: order.tableId,
      cashierId: order.cashierId,
      waiterId: order.waiterId,
      notes: order.notes,
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      closedAt: order.closedAt?.toISOString() ?? null,
    },
    item: {
      id: selectedItem.id,
      productId: selectedItem.productId,
      productName: selectedItem.productName,
      qty: 1,
      unitPrice: deletedUnitPrice,
      lineTotal: deletedUnitPrice,
      unitCostSnapshot:
        selectedItem.unitCostSnapshot == null
          ? null
          : Number(selectedItem.unitCostSnapshot),
      costSnapshotSource: selectedItem.costSnapshotSource,
      recipeVersionId: selectedItem.recipeVersionId,
      createdAt: selectedItem.createdAt.toISOString(),
      assignedUserId: selectedItem.assignedUserId,
      station: selectedItem.station,
      modifiers: selectedItem.modifiers.map((modifier) => ({
        id: modifier.id,
        modifierId: modifier.modifierId,
        modifierName: modifier.modifierName,
        qty: modifier.qty,
        price: Number(modifier.price),
      })),
    },
    payments: order.payments.map((payment) => ({
      id: payment.id,
      cashierId: payment.cashierId,
      cashierName: payment.cashierName,
      method: payment.method,
      amountPaid: Number(payment.amountPaid),
      reference: payment.reference,
      createdAt: payment.createdAt.toISOString(),
    })),
  };

  await prisma.$transaction(async (tx) => {
    if (nextItemQuantity <= 0) {
      await tx.orderItemModifier.deleteMany({
        where: {
          orderItemId,
        },
      });

      await tx.orderItem.delete({
        where: {
          id: orderItemId,
        },
      });
    } else {
      await tx.orderItem.update({
        where: {
          id: orderItemId,
        },
        data: {
          qty: nextItemQuantity,
          lineTotal: toDecimal(nextItemLineTotal),
        },
      });
    }

    const remainingItems =
      nextItemQuantity <= 0
        ? order.orderItems.filter((item) => item.id !== orderItemId)
        : order.orderItems.map((item) =>
            item.id === orderItemId
              ? {
                  ...item,
                  qty: nextItemQuantity,
                  lineTotal: toDecimal(nextItemLineTotal),
                }
              : item,
          );

    if (remainingItems.length === 0) {
      await tx.payment.deleteMany({
        where: {
          orderId,
        },
      });

      await tx.order.delete({
        where: {
          id: orderId,
        },
      });

      return;
    }

    const recalculatedTotal = remainingItems.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0,
    );

    await tx.order.update({
      where: {
        id: orderId,
      },
      data: {
        total: toDecimal(recalculatedTotal),
      },
    });

    const [firstPayment, ...extraPayments] = order.payments;

    if (firstPayment) {
      if (extraPayments.length > 0) {
        await tx.payment.deleteMany({
          where: {
            id: {
              in: extraPayments.map((payment) => payment.id),
            },
          },
        });
      }

      await tx.payment.update({
        where: {
          id: firstPayment.id,
        },
        data: {
          amountPaid: toDecimal(recalculatedTotal),
        },
      });
    }
  });

  const cookieStore = await cookies();
  const existingSnapshots = parseDeletedOrderItemSnapshots(
    cookieStore.get(CASHIER_DELETED_ORDER_ITEM_COOKIE)?.value,
  );

  setUndoCookie(cookieStore, [undoSnapshot, ...existingSnapshots]);

  revalidateCashierViews();
  redirect(returnPath);
}

export async function restoreDeletedWaiterOrderItem(formData: FormData) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);

  const undoId = String(formData.get("undoId") ?? "").trim();
  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const returnPath = getReturnPath(waiterId);
  const cookieStore = await cookies();
  const snapshots = parseDeletedOrderItemSnapshots(
    cookieStore.get(CASHIER_DELETED_ORDER_ITEM_COOKIE)?.value,
  );
  const snapshot = snapshots.find((entry) => entry.undoId === undoId);

  if (!snapshot) {
    redirect(returnPath);
  }

  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();
  const orderCreatedAt = new Date(snapshot.order.createdAt);

  if (orderCreatedAt < businessDayStart || orderCreatedAt >= businessDayEnd) {
    setUndoCookie(cookieStore, filterSnapshotsByUndoId(snapshots, undoId));
    redirect(getReturnPath(snapshot.waiterId));
  }

  await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findUnique({
      where: {
        id: snapshot.order.id,
      },
      select: {
        id: true,
        total: true,
        orderItems: {
          select: {
            id: true,
            qty: true,
            lineTotal: true,
          },
        },
        payments: {
          select: {
            id: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!existingOrder) {
      await tx.order.create({
        data: {
          id: snapshot.order.id,
          orderNumber: snapshot.order.orderNumber,
          type: snapshot.order.type as "DINE_IN" | "TAKEOUT" | "DELIVERY",
          status: snapshot.order.status as "OPEN" | "PAID" | "CANCELLED",
          tableId: snapshot.order.tableId,
          // Waiter-originated table orders still settle through cashier flows, so keep both attribution columns.
          cashierId: snapshot.order.cashierId,
          waiterId: snapshot.order.waiterId,
          notes: snapshot.order.notes,
          total: toDecimal(snapshot.order.total),
          createdAt: new Date(snapshot.order.createdAt),
          closedAt: snapshot.order.closedAt
            ? new Date(snapshot.order.closedAt)
            : null,
        },
      });

      await tx.orderItem.create({
        data: {
          id: snapshot.item.id,
          orderId: snapshot.order.id,
          productId: snapshot.item.productId,
          productName: snapshot.item.productName,
          qty: snapshot.item.qty,
          unitPrice: toDecimal(snapshot.item.unitPrice),
          lineTotal: toDecimal(snapshot.item.lineTotal),
          unitCostSnapshot:
            snapshot.item.unitCostSnapshot == null
              ? null
              : toDecimal(snapshot.item.unitCostSnapshot),
          costSnapshotSource: snapshot.item.costSnapshotSource ?? null,
          recipeVersionId: snapshot.item.recipeVersionId ?? null,
          createdAt: new Date(snapshot.item.createdAt),
          assignedUserId: snapshot.item.assignedUserId,
          station: snapshot.item.station as
            | "CUNTO_SOOMAALI"
            | "FAST_FOOD"
            | "CABITAAN"
            | "BARISTA"
            | null,
        },
      });

      if (snapshot.item.modifiers.length > 0) {
        await tx.orderItemModifier.createMany({
          data: snapshot.item.modifiers.map((modifier) => ({
            id: modifier.id,
            orderItemId: snapshot.item.id,
            modifierId: modifier.modifierId,
            modifierName: modifier.modifierName,
            qty: modifier.qty,
            price: toDecimal(modifier.price),
          })),
        });
      }

      if (snapshot.payments.length > 0) {
        await tx.payment.createMany({
          data: snapshot.payments.map((payment) => ({
            id: payment.id,
            orderId: snapshot.order.id,
            cashierId: payment.cashierId,
            cashierName: payment.cashierName,
            method: payment.method as "CASH" | "MYCASH" | "GOLIS" | "Dahabshiil" | "OTHER",
            amountPaid: toDecimal(payment.amountPaid),
            reference: payment.reference,
            createdAt: new Date(payment.createdAt),
          })),
        });
      }

      return;
    }

    const existingOrderItem = existingOrder.orderItems.find(
      (item) => item.id === snapshot.item.id,
    );

    if (existingOrderItem) {
      await tx.orderItem.update({
        where: {
          id: snapshot.item.id,
        },
        data: {
          qty: existingOrderItem.qty + snapshot.item.qty,
          lineTotal: toDecimal(
            Number(existingOrderItem.lineTotal) + Number(snapshot.item.lineTotal),
          ),
        },
      });
    } else {
      await tx.orderItem.create({
        data: {
          id: snapshot.item.id,
          orderId: snapshot.order.id,
          productId: snapshot.item.productId,
          productName: snapshot.item.productName,
          qty: snapshot.item.qty,
          unitPrice: toDecimal(snapshot.item.unitPrice),
          lineTotal: toDecimal(snapshot.item.lineTotal),
          unitCostSnapshot:
            snapshot.item.unitCostSnapshot == null
              ? null
              : toDecimal(snapshot.item.unitCostSnapshot),
          costSnapshotSource: snapshot.item.costSnapshotSource ?? null,
          recipeVersionId: snapshot.item.recipeVersionId ?? null,
          createdAt: new Date(snapshot.item.createdAt),
          assignedUserId: snapshot.item.assignedUserId,
          station: snapshot.item.station as
            | "CUNTO_SOOMAALI"
            | "FAST_FOOD"
            | "CABITAAN"
            | "BARISTA"
            | null,
        },
      });

      if (snapshot.item.modifiers.length > 0) {
        await tx.orderItemModifier.createMany({
          data: snapshot.item.modifiers.map((modifier) => ({
            id: modifier.id,
            orderItemId: snapshot.item.id,
            modifierId: modifier.modifierId,
            modifierName: modifier.modifierName,
            qty: modifier.qty,
            price: toDecimal(modifier.price),
          })),
        });
      }
    }

    const recalculatedTotal =
      Number(existingOrder.total) + Number(snapshot.item.lineTotal);

    await tx.order.update({
      where: {
        id: snapshot.order.id,
      },
      data: {
        total: toDecimal(recalculatedTotal),
      },
    });

    const [firstPayment] = existingOrder.payments;

    if (firstPayment) {
      await tx.payment.update({
        where: {
          id: firstPayment.id,
        },
        data: {
          amountPaid: toDecimal(recalculatedTotal),
        },
      });
    } else if (snapshot.payments.length > 0) {
      const [payment] = snapshot.payments;

      await tx.payment.create({
        data: {
          id: payment.id,
          orderId: snapshot.order.id,
          cashierId: payment.cashierId,
          cashierName: payment.cashierName,
          method: payment.method as "CASH" | "MYCASH" | "GOLIS" | "Dahabshiil" | "OTHER",
          amountPaid: toDecimal(recalculatedTotal),
          reference: payment.reference,
          createdAt: new Date(payment.createdAt),
        },
      });
    }
  });

  setUndoCookie(cookieStore, filterSnapshotsByUndoId(snapshots, undoId));
  revalidateCashierViews();
  redirect(getReturnPath(snapshot.waiterId));
}

export async function discardDeletedWaiterOrderItem(formData: FormData) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);

  const undoId = String(formData.get("undoId") ?? "").trim();
  const waiterId = String(formData.get("waiterId") ?? "").trim();
  const cookieStore = await cookies();
  const snapshots = parseDeletedOrderItemSnapshots(
    cookieStore.get(CASHIER_DELETED_ORDER_ITEM_COOKIE)?.value,
  );

  setUndoCookie(cookieStore, filterSnapshotsByUndoId(snapshots, undoId));
  revalidateCashierViews();
  redirect(getReturnPath(waiterId));
}
