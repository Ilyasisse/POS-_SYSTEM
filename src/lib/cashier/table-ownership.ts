import { Prisma, type UserRole } from "@prisma/client";

type TableActor = { id: string; role: UserRole };

export class TableOwnershipError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 = 409,
  ) {
    super(message);
    this.name = "TableOwnershipError";
  }
}

export function canUseCashierTable(
  actor: TableActor,
  ownerCashierId: string | null,
) {
  return (
    actor.role === "ADMIN" ||
    actor.role === "MANAGER" ||
    ownerCashierId === null ||
    ownerCashierId === actor.id
  );
}

/** Serializes claims and payments against the same table. */
export async function lockCashierTable(
  tx: Prisma.TransactionClient,
  tableId: string,
  actor: TableActor,
  claimIfUnowned: boolean,
) {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Table" WHERE "id" = ${tableId} FOR UPDATE`,
  );
  const table = await tx.table.findUnique({
    where: { id: tableId },
    select: { isActive: true, ownerCashierId: true },
  });
  if (!table?.isActive) {
    throw new TableOwnershipError("The selected table is not active.", 400);
  }
  if (!canUseCashierTable(actor, table.ownerCashierId)) {
    throw new TableOwnershipError(
      "This table belongs to another cashier. Refresh and choose an available table.",
    );
  }
  if (
    claimIfUnowned &&
    actor.role === "CASHIER" &&
    table.ownerCashierId === null
  ) {
    const existingOrder = await tx.order.findFirst({
      where: { tableId, type: "DINE_IN", status: "OPEN" },
      select: { id: true },
    });
    if (existingOrder) {
      throw new TableOwnershipError(
        "This occupied table has no cashier owner. Ask a manager to resolve it.",
      );
    }
    await tx.table.update({
      where: { id: tableId },
      data: { ownerCashierId: actor.id },
    });
  }
}
