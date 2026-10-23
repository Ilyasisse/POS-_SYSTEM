import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTableTransferAllowed } from "@/lib/cashier/table-transfer-validation";

export async function transferOpenTableService(input: {
  sourceTableId: string;
  targetTableId: string;
}) {
  const sourceTableId = input.sourceTableId.trim();
  const targetTableId = input.targetTableId.trim();

  if (!sourceTableId || !targetTableId || sourceTableId === targetTableId) {
    assertTableTransferAllowed({
      sourceTableId,
      targetTableId,
      sourceExists: true,
      targetExists: true,
      sourceOpenOrderCount: 1,
      targetOpenOrderCount: 0,
    });
  }

  return prisma.$transaction(async (tx) => {
    const tableIds = [sourceTableId, targetTableId].sort();
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Table" WHERE "id" IN (${Prisma.join(tableIds)}) ORDER BY "id" FOR UPDATE`,
    );

    const [tables, sourceOpenOrderCount, targetOpenOrderCount] =
      await Promise.all([
        tx.table.findMany({
          where: { id: { in: tableIds }, isActive: true },
          select: { id: true },
        }),
        tx.order.count({
          where: { tableId: sourceTableId, type: "DINE_IN", status: "OPEN" },
        }),
        tx.order.count({
          where: { tableId: targetTableId, type: "DINE_IN", status: "OPEN" },
        }),
      ]);
    const activeTableIds = new Set(tables.map((table) => table.id));

    assertTableTransferAllowed({
      sourceTableId,
      targetTableId,
      sourceExists: activeTableIds.has(sourceTableId),
      targetExists: activeTableIds.has(targetTableId),
      sourceOpenOrderCount,
      targetOpenOrderCount,
    });

    const movedOrders = await tx.order.updateMany({
      where: { tableId: sourceTableId, type: "DINE_IN", status: "OPEN" },
      data: { tableId: targetTableId },
    });

    await Promise.all([
      tx.tableCheck.updateMany({
        where: {
          tableId: sourceTableId,
          closedAt: null,
          orders: { some: { tableId: targetTableId, status: "OPEN" } },
        },
        data: { tableId: targetTableId },
      }),
      tx.paymentRequest.updateMany({
        where: { tableId: sourceTableId, status: "PENDING" },
        data: { tableId: targetTableId },
      }),
      tx.paymentDeferral.updateMany({
        where: { tableId: sourceTableId, resolvedAt: null },
        data: { tableId: targetTableId },
      }),
    ]);

    return { movedOrderCount: movedOrders.count };
  });
}
