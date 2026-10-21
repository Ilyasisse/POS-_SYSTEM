"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { availabilityRestorationTime } from "@/lib/products/availability";
import {
  availabilitySchema,
  catalogFormValues,
  catalogKinds,
  catalogSchemas,
  fieldErrors,
  identitySchema,
  orderingMatches,
  type CatalogKind,
  type CatalogResult,
} from "@/lib/catalog/catalog";

const conflict =
  "This item changed since you opened it. Close and reopen it to load the latest changes.";
class CatalogConflict extends Error {}
class CatalogInputError extends Error {}

function failure(error: unknown): CatalogResult {
  if (error instanceof CatalogConflict || error instanceof CatalogInputError)
    return { ok: false, message: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return {
        ok: false,
        message: "That name is already in use.",
        errors: { name: "Choose a different name." },
      };
    if (error.code === "P2003")
      return {
        ok: false,
        message:
          "This item is linked to other records. Deactivate it instead, or check its linked items.",
      };
    if (error.code === "P2034" || error.code === "P2025")
      return { ok: false, message: conflict };
  }
  console.error("Catalog mutation failed", error);
  return {
    ok: false,
    message: "Could not save the catalog change. Please try again.",
  };
}
function refreshCatalog() {
  // Invalidate lists without rerendering a deleted direct editor before its
  // client has returned to the list. Direct editors read uncached data.
  revalidatePath("/admin", "page");
  for (const kind of catalogKinds) revalidatePath(`/admin/${kind}`);
  for (const path of [
    "/menu",
    "/customer",
    "/waiter",
    "/cashier",
    "/api/GET/Product",
    "/api/GET/Product/all",
    "/api/GET/Category",
  ])
    revalidatePath(path);
}
function availabilityData(
  value:
    | z.infer<typeof availabilitySchema>
    | z.infer<typeof catalogSchemas.products>,
  previous?: {
    availabilityRestoresAt: Date | null;
    availableForSale: boolean;
  } | null,
) {
  if (
    value.durationMinutes === "keep" &&
    !value.availableForSale &&
    (!previous || previous.availableForSale)
  )
    throw new CatalogInputError("Choose when sales should resume.");
  return {
    availableForSale: value.availableForSale,
    availabilityReason: value.availableForSale
      ? null
      : value.availabilityReason,
    availabilityRestoresAt: value.availableForSale
      ? null
      : value.durationMinutes === "keep"
        ? previous!.availabilityRestoresAt
        : availabilityRestorationTime(
            value.durationMinutes === "" ? null : Number(value.durationMinutes),
          ),
  };
}
async function auditAvailability(
  tx: Prisma.TransactionClient,
  actorId: string,
  id: string,
  previous: {
    availableForSale: boolean;
    availabilityReason: string | null;
    availabilityRestoresAt: Date | null;
  } | null,
  next: ReturnType<typeof availabilityData>,
) {
  const serialize = (value: typeof previous) =>
    value
      ? {
          ...value,
          availabilityRestoresAt:
            value.availabilityRestoresAt?.toISOString() ?? null,
        }
      : {};
  if (JSON.stringify(serialize(previous)) === JSON.stringify(serialize(next)))
    return;
  await tx.auditLog.create({
    data: {
      actorUserId: actorId,
      entityType: "Product",
      entityId: id,
      action: next.availableForSale
        ? "product.availability.restored"
        : "product.availability.paused",
      reason: next.availabilityReason ?? "Resumed sales without changing stock",
      previousValue: serialize(previous),
      newValue: serialize(next),
    },
  });
}

export async function saveCatalogItem(
  kind: CatalogKind,
  formData: FormData,
): Promise<CatalogResult> {
  const actor = await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  if (!z.enum(catalogKinds).safeParse(kind).success)
    return { ok: false, message: "Invalid catalog section." };
  const values = catalogFormValues(formData);
  const parsed = catalogSchemas[kind].safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: fieldErrors(parsed.error),
    };
  const rawId = formData.get("id");
  const identity = rawId ? identitySchema.safeParse(values) : null;
  if (identity && !identity.success)
    return {
      ok: false,
      message: "Invalid item version. Close and reopen the editor.",
    };
  const itemId = identity?.success ? identity.data.id : null;
  const version = identity?.success
    ? new Date(identity.data.updatedAt)
    : undefined;
  try {
    await prisma.$transaction(
      async (tx) => {
        if (kind === "products") {
          const parsedProduct = catalogSchemas.products.parse(values);
          const {
            durationMinutes: _duration,
            availabilityReason: _reason,
            availableForSale: _sale,
            ...fields
          } = parsedProduct;
          void _duration;
          void _reason;
          void _sale;
          const previous = itemId
            ? await tx.product.findUnique({ where: { id: itemId } })
            : null;
          if (
            itemId &&
            (!previous || previous.updatedAt.getTime() !== version!.getTime())
          )
            throw new CatalogConflict(conflict);
          if (
            !(await tx.category.findUnique({
              where: { id: fields.categoryId },
              select: { id: true },
            }))
          )
            throw new CatalogInputError(
              "The selected category no longer exists.",
            );
          const availability = availabilityData(parsedProduct, previous);
          const data = {
            ...fields,
            imageUrl: fields.imageUrl || null,
            pronunciationAudioUrl: fields.pronunciationAudioUrl || null,
            description: fields.description || null,
            ...availability,
          };
          const product = itemId
            ? await tx.product.update({
                where: { id: itemId, updatedAt: version },
                data,
              })
            : await tx.product.create({ data });
          await auditAvailability(
            tx,
            actor.id,
            product.id,
            previous
              ? {
                  availableForSale: previous.availableForSale,
                  availabilityReason: previous.availabilityReason,
                  availabilityRestoresAt: previous.availabilityRestoresAt,
                }
              : null,
            availability,
          );
        } else if (kind === "categories") {
          const value = catalogSchemas.categories.parse(values);
          const data = { ...value, station: value.station || null };
          if (itemId)
            await tx.category.update({
              where: { id: itemId, updatedAt: version },
              data,
            });
          else await tx.category.create({ data });
        } else if (kind === "modifiers") {
          const value = catalogSchemas.modifiers.parse(values);
          if (itemId && value.productIds.length !== 1)
            throw new CatalogInputError(
              "An existing modifier must belong to exactly one product.",
            );
          const [productCount, group] = await Promise.all([
            tx.product.count({ where: { id: { in: value.productIds } } }),
            tx.modifierGroup.findUnique({
              where: { id: value.modifierGroupId },
              select: { id: true },
            }),
          ]);
          if (productCount !== value.productIds.length || !group)
            throw new CatalogInputError(
              "A selected product or group no longer exists. Reopen the editor.",
            );
          const { productIds, ...fields } = value;
          const data = {
            ...fields,
            pronunciationAudioUrl: fields.pronunciationAudioUrl || null,
          };
          if (itemId)
            await tx.modifier.update({
              where: { id: itemId, updatedAt: version },
              data: { ...data, productId: productIds[0] },
            });
          else
            await tx.modifier.createMany({
              data: productIds.map((productId) => ({ ...data, productId })),
            });
        } else {
          const data = catalogSchemas["modifier-groups"].parse(values);
          if (itemId)
            await tx.modifierGroup.update({
              where: { id: itemId, updatedAt: version },
              data,
            });
          else await tx.modifierGroup.create({ data });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    refreshCatalog();
    return {
      ok: true,
      message: itemId ? "Changes saved." : "Catalog item created.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function changeCatalogAvailability(
  formData: FormData,
): Promise<CatalogResult> {
  const actor = await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const values = catalogFormValues(formData);
  const parsed = availabilitySchema.safeParse(values),
    identity = identitySchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: fieldErrors(parsed.error),
    };
  if (!identity.success)
    return { ok: false, message: "Invalid item version. Refresh the list." };
  try {
    await prisma.$transaction(
      async (tx) => {
        const previous = await tx.product.findUnique({
          where: { id: identity.data.id },
        });
        if (
          !previous ||
          previous.updatedAt.toISOString() !== identity.data.updatedAt
        )
          throw new CatalogConflict(conflict);
        const next = availabilityData(parsed.data, previous);
        // Sale availability never writes stockQty or inventory records.
        await tx.product.update({
          where: { id: previous.id, updatedAt: previous.updatedAt },
          data: next,
        });
        await auditAvailability(
          tx,
          actor.id,
          previous.id,
          {
            availableForSale: previous.availableForSale,
            availabilityReason: previous.availabilityReason,
            availabilityRestoresAt: previous.availabilityRestoresAt,
          },
          next,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    refreshCatalog();
    return {
      ok: true,
      message: parsed.data.availableForSale
        ? "Sales resumed. Stock is unchanged."
        : "Sales paused.",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteCatalogItem(
  kind: CatalogKind,
  formData: FormData,
): Promise<CatalogResult> {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  if (!z.enum(catalogKinds).safeParse(kind).success)
    return { ok: false, message: "Invalid catalog section." };
  const identity = identitySchema.safeParse(Object.fromEntries(formData));
  if (!identity.success || formData.get("confirmed") !== "yes")
    return {
      ok: false,
      message: "Confirm deletion and provide the current item version.",
    };
  const { id, updatedAt } = identity.data;
  const where = { id, updatedAt: new Date(updatedAt) };
  try {
    const message = await prisma.$transaction(
      async (tx) => {
        if (kind === "products") {
          const product = await tx.product.findUnique({
            where,
            include: {
              _count: {
                select: {
                  orderItems: true,
                  modifiers: true,
                  supplierCatalogItems: true,
                  recipeVersions: true,
                  stockEvents: true,
                  inventoryCountLines: true,
                },
              },
            },
          });
          if (!product) throw new CatalogConflict(conflict);
          if (
            Object.values(product._count).some((count) => count > 0) ||
            Number(product.stockQty) !== 0
          ) {
            await tx.product.update({ where, data: { isActive: false } });
            return "Product deactivated. Its stock, linked items and order history are preserved.";
          }
          await tx.product.delete({ where });
        } else if (kind === "categories") {
          if (await tx.product.count({ where: { categoryId: id } }))
            throw new CatalogInputError(
              "This category contains products. Move them first, or deactivate the category in its editor.",
            );
          await tx.category.delete({ where });
        } else if (kind === "modifiers") {
          if (await tx.orderItemModifier.count({ where: { modifierId: id } })) {
            await tx.modifier.update({ where, data: { isActive: false } });
            return "Modifier deactivated. Existing orders are preserved.";
          }
          await tx.modifier.delete({ where });
        } else {
          if (await tx.modifier.count({ where: { modifierGroupId: id } }))
            throw new CatalogInputError(
              "This group has linked options. Move or remove them first, or deactivate the group in its editor.",
            );
          await tx.modifierGroup.delete({ where });
        }
        return "Catalog item deleted.";
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    refreshCatalog();
    return { ok: true, message };
  } catch (error) {
    return failure(error);
  }
}

export async function saveCategoryOrder(
  input: unknown,
): Promise<CatalogResult> {
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const parsed = z
    .object({
      ids: z.array(z.string().min(1).max(128)).max(10000),
      expected: z
        .array(identitySchema.extend({ sortOrder: z.number().int() }))
        .max(10000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid category order." };
  try {
    await prisma.$transaction(
      async (tx) => {
        const current = await tx.category.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
          select: { id: true, sortOrder: true, updatedAt: true },
        });
        if (
          !orderingMatches(
            parsed.data.expected,
            current.map((row) => ({
              ...row,
              updatedAt: row.updatedAt.toISOString(),
            })),
          )
        )
          throw new CatalogConflict(
            "Category order changed. Reload the order before trying again.",
          );
        const ids = parsed.data.ids;
        if (
          new Set(ids).size !== current.length ||
          ids.length !== current.length ||
          current.some((row) => !ids.includes(row.id))
        )
          throw new CatalogInputError("Include every category exactly once.");
        for (const [sortOrder, id] of ids.entries())
          await tx.category.update({ where: { id }, data: { sortOrder } });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
    refreshCatalog();
    return { ok: true, message: "Menu order saved." };
  } catch (error) {
    return failure(error);
  }
}
