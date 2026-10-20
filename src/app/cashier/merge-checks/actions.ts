"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { buildMergedRoundAssignments } from "@/lib/cashier/table-check-merge";
import { prisma } from "@/lib/prisma";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function mergeTableChecksAction(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.ORDER_MANAGE);
  const sourceCheckId = value(formData, "sourceCheckId");
  const destinationCheckId = value(formData, "destinationCheckId");
  if (!sourceCheckId || !destinationCheckId || sourceCheckId === destinationCheckId) {
    redirect("/cashier/merge-checks?mergeStatus=invalid");
  }

  let mergeStatus = "merged";
  try {
    await prisma.$transaction(
      async (tx) => {
        const requestedChecks = await tx.tableCheck.findMany({
          where: { id: { in: [sourceCheckId, destinationCheckId] } },
          select: { id: true, tableId: true },
        });
        if (requestedChecks.length !== 2) throw new Error("Check not found.");

        const tableIds = [...new Set(requestedChecks.map((check) => check.tableId))].sort();
        const checkIds = [sourceCheckId, destinationCheckId].sort();
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Table" WHERE "id" IN (${Prisma.join(tableIds)}) ORDER BY "id" FOR UPDATE`,
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "TableCheck" WHERE "id" IN (${Prisma.join(checkIds)}) ORDER BY "id" FOR UPDATE`,
        );

        const checks = await tx.tableCheck.findMany({
          where: { id: { in: checkIds }, closedAt: null },
          include: {
            table: { select: { id: true, name: true, isActive: true } },
            orders: {
              orderBy: [{ tableCheckRound: "asc" }, { createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                status: true,
                tableCheckRound: true,
                payments: { select: { id: true }, take: 1 },
              },
            },
          },
        });
        const source = checks.find((check) => check.id === sourceCheckId);
        const destination = checks.find((check) => check.id === destinationCheckId);
        if (!source || !destination) throw new Error("Both checks must still be open.");
        if (!source.table.isActive || !destination.table.isActive) {
          throw new Error("Both tables must be active.");
        }
        if (!source.orders.length || !destination.orders.length) {
          throw new Error("Both checks must contain orders.");
        }
        const allOrders = [...source.orders, ...destination.orders];
        if (allOrders.some((order) => order.status !== "OPEN" || order.payments.length)) {
          throw new Error("Checks with settled or cancelled rounds cannot be merged.");
        }

        const activeRequests = await tx.paymentRequest.count({
          where: {
            tableId: { in: tableIds },
            status: { in: ["PENDING", "PARTIALLY_MATCHED"] },
          },
        });
        const activeDeferrals = await tx.paymentDeferral.count({
          where: { tableId: { in: tableIds }, resolvedAt: null },
        });
        if (activeRequests || activeDeferrals) {
          throw new Error("Finish pending payment activity before merging checks.");
        }

        const highestRound = destination.orders.reduce(
          (highest, order) => Math.max(highest, order.tableCheckRound ?? 0),
          0,
        );
        const assignments = buildMergedRoundAssignments(
          source.orders.map((order) => order.id),
          highestRound,
        );
        for (const assignment of assignments) {
          await tx.order.update({
            where: { id: assignment.orderId },
            data: {
              tableId: destination.tableId,
              tableCheckId: destination.id,
              tableCheckRound: assignment.tableCheckRound,
            },
          });
        }

        const mergedAt = new Date();
        await tx.tableCheck.update({
          where: { id: source.id },
          data: { closedAt: mergedAt },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "TABLE_CHECK_MERGED",
            entityType: "TableCheck",
            entityId: source.id,
            previousValue: {
              checkNumber: source.checkNumber,
              tableId: source.tableId,
              tableName: source.table.name,
              orderIds: source.orders.map((order) => order.id),
            },
            newValue: {
              destinationCheckId: destination.id,
              destinationCheckNumber: destination.checkNumber,
              destinationTableId: destination.tableId,
              destinationTableName: destination.table.name,
              rounds: assignments,
            },
            relatedEntityType: "TableCheck",
            relatedEntityId: destination.id,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
    revalidatePath("/cashier");
    revalidatePath("/cashier/order");
    revalidatePath("/cashier/merge-checks");
  } catch (error) {
    console.error("Failed to merge table checks:", error);
    mergeStatus = "failed";
  }

  redirect(`/cashier/merge-checks?mergeStatus=${mergeStatus}`);
}
