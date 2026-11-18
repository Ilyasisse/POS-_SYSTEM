import type { Prisma } from "@prisma/client";

export class InventoryAccessError extends Error {}

/** Must run on the same transaction/connection as all subsequent inventory writes. */
export async function configureInventoryCafeteria(
  tx: Prisma.TransactionClient,
  actorId: string,
  supplyId: string,
) {
  const [ownership] = await tx.$queryRaw<
    {
      actorCafeteria: string | null;
      supplyCafeteria: string | null;
    }[]
  >`
    SELECT to_jsonb(staff)->>'cafeteriaId' AS "actorCafeteria",
           to_jsonb(supply)->>'cafeteriaId' AS "supplyCafeteria"
    FROM public."Staff" staff CROSS JOIN public."InventorySupply" supply
    WHERE staff.id = ${actorId} AND supply.id = ${supplyId}
  `;
  if (!ownership) throw new InventoryAccessError("This supply is no longer available.");
  const { actorCafeteria, supplyCafeteria } = ownership;
  // The repository's original single-cafeteria schema has neither column.
  // JSON extraction also lets its migrations and fixtures keep working.
  if (actorCafeteria === null && supplyCafeteria === null) return;
  if (!actorCafeteria || actorCafeteria !== supplyCafeteria)
    throw new InventoryAccessError("This supply is not available in your cafeteria.");
  await tx.$queryRaw`SELECT set_config('app.cafeteria_id', ${actorCafeteria}, true)`;
}
