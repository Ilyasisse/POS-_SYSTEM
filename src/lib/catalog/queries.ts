import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { availableForSaleWhere } from "@/lib/products/availability";
import { stations } from "@/lib/catalog/catalog";
import type { CatalogData, CatalogKind, CatalogRecord } from "./catalog";

export type CatalogSearchParams = Record<string, string | string[] | undefined>;
const groupInclude = {
  modifiers: {
    orderBy: { name: "asc" as const },
    include: { product: { select: { name: true } } },
  },
};
type ProductRow = Prisma.ProductGetPayload<{ include: { category: true } }>;
type CategoryRow = Prisma.CategoryGetPayload<{
  include: { _count: { select: { products: true } } };
}>;
type ModifierRow = Prisma.ModifierGetPayload<{
  include: { product: true; modifierGroup: true };
}>;
type GroupRow = Prisma.ModifierGroupGetPayload<{
  include: typeof groupInclude;
}>;
const productRecord = (row: ProductRow): CatalogRecord => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updatedAt.toISOString(),
  isActive: row.isActive,
  price: Number(row.price),
  categoryId: row.categoryId,
  categoryName: row.category.name,
  categoryActive: row.category.isActive,
  imageUrl: row.imageUrl,
  description: row.description,
  pronunciationAudioUrl: row.pronunciationAudioUrl,
  trackStock: row.trackStock,
  stockQty: Number(row.stockQty),
  availableForSale: row.availableForSale,
  availabilityReason: row.availabilityReason,
  availabilityRestoresAt: row.availabilityRestoresAt?.toISOString() ?? null,
  isPopular: row.isPopular,
});
const categoryRecord = (row: CategoryRow): CatalogRecord => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updatedAt.toISOString(),
  isActive: row.isActive,
  station: row.station,
  sortOrder: row.sortOrder,
  productCount: row._count.products,
});
const modifierRecord = (row: ModifierRow): CatalogRecord => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updatedAt.toISOString(),
  isActive: row.isActive,
  price: Number(row.price),
  pronunciationAudioUrl: row.pronunciationAudioUrl,
  productId: row.productId,
  productName: row.product.name,
  modifierGroupId: row.modifierGroupId,
  groupName: row.modifierGroup.name,
});
const groupRecord = (row: GroupRow): CatalogRecord => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updatedAt.toISOString(),
  isActive: row.isActive,
  isRequired: row.isRequired,
  minSelect: row.minSelect,
  maxSelect: row.maxSelect,
  options: row.modifiers.map((option) => ({
    id: option.id,
    name: option.name,
    productId: option.productId,
    productName: option.product.name,
    price: Number(option.price),
    isActive: option.isActive,
  })),
});

export async function getCatalogData(
  kind: CatalogKind,
  search: CatalogSearchParams,
  directEditor?: string,
): Promise<CatalogData> {
  // Authorize before starting any catalog read, including editor option queries.
  await requirePermission(PERMISSIONS.CATALOG_MANAGE);
  const params: Record<string, string> = {};
  for (const key of [
    "q",
    "category",
    "station",
    "status",
    "availability",
    "product",
    "group",
    "page",
    "edit",
  ]) {
    const value = search[key];
    if (typeof value === "string" && value && value.length <= 200)
      params[key] = value;
  }
  const q = params.q?.trim();
  const name = q ? { name: { contains: q, mode: "insensitive" as const } } : {};
  const active =
    params.status === "active"
      ? { isActive: true }
      : params.status === "inactive"
        ? { isActive: false }
        : {};
  const requestedPage = /^\d+$/.test(params.page ?? "")
    ? Math.max(1, Math.min(Number(params.page), 1_000_000))
    : 1;
  const take = 10;
  const editorId = directEditor ?? params.edit;
  const [categories, products, groups, ordering] = await Promise.all([
    kind === "products" || kind === "categories"
      ? prisma.category.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
          select: { id: true, name: true },
        })
      : [],
    kind === "modifiers"
      ? prisma.product.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [],
    kind === "modifiers"
      ? prisma.modifierGroup.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [],
    kind === "categories"
      ? prisma.category.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
          select: { id: true, sortOrder: true, updatedAt: true },
        })
      : [],
  ]);
  let total = 0,
    page = 1,
    pages = 1,
    rows: CatalogRecord[] = [],
    editor: CatalogData["editor"] = editorId === "new" ? "new" : null;
  const paginate = (count: number) => {
    total = count;
    pages = Math.max(1, Math.ceil(count / take));
    page = Math.min(requestedPage, pages);
    return { skip: (page - 1) * take, take };
  };
  if (kind === "products") {
    const now = new Date();
    const where: Prisma.ProductWhereInput = {
      ...name,
      ...active,
      ...(params.category && params.category !== "all"
        ? { categoryId: params.category }
        : {}),
      ...(params.status === "hidden"
        ? { category: { isActive: false } }
        : params.status === "active"
          ? { category: { isActive: true } }
          : {}),
      ...(params.availability === "available"
        ? availableForSaleWhere(now)
        : params.availability === "sold-out"
          ? {
              availableForSale: false,
              OR: [
                { availabilityRestoresAt: null },
                { availabilityRestoresAt: { gt: now } },
              ],
            }
          : {}),
    };
    const pagination = paginate(await prisma.product.count({ where }));
    const [list, selected] = await Promise.all([
      prisma.product.findMany({
        where,
        ...pagination,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: { category: true },
      }),
      editorId && editorId !== "new"
        ? prisma.product.findUnique({
            where: { id: editorId },
            include: { category: true },
          })
        : null,
    ]);
    rows = list.map(productRecord);
    if (selected) editor = productRecord(selected);
  } else if (kind === "categories") {
    const station = stations.find((value) => value === params.station);
    const where = { ...name, ...active, ...(station ? { station } : {}) };
    const pagination = paginate(await prisma.category.count({ where }));
    const [list, selected] = await Promise.all([
      prisma.category.findMany({
        where,
        ...pagination,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        include: { _count: { select: { products: true } } },
      }),
      editorId && editorId !== "new"
        ? prisma.category.findUnique({
            where: { id: editorId },
            include: { _count: { select: { products: true } } },
          })
        : null,
    ]);
    rows = list.map(categoryRecord);
    if (selected) editor = categoryRecord(selected);
  } else if (kind === "modifiers") {
    const where = {
      ...name,
      ...active,
      ...(params.product && params.product !== "all"
        ? { productId: params.product }
        : {}),
      ...(params.group && params.group !== "all"
        ? { modifierGroupId: params.group }
        : {}),
    };
    const pagination = paginate(await prisma.modifier.count({ where }));
    const [list, selected] = await Promise.all([
      prisma.modifier.findMany({
        where,
        ...pagination,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        include: { product: true, modifierGroup: true },
      }),
      editorId && editorId !== "new"
        ? prisma.modifier.findUnique({
            where: { id: editorId },
            include: { product: true, modifierGroup: true },
          })
        : null,
    ]);
    rows = list.map(modifierRecord);
    if (selected) editor = modifierRecord(selected);
  } else {
    const where = { ...name, ...active };
    const pagination = paginate(await prisma.modifierGroup.count({ where }));
    const [list, selected] = await Promise.all([
      prisma.modifierGroup.findMany({
        where,
        ...pagination,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        include: groupInclude,
      }),
      editorId && editorId !== "new"
        ? prisma.modifierGroup.findUnique({
            where: { id: editorId },
            include: groupInclude,
          })
        : null,
    ]);
    rows = list.map(groupRecord);
    if (selected) editor = groupRecord(selected);
  }
  if (directEditor && !editor) notFound();
  return {
    kind,
    rows,
    total,
    page,
    pages,
    params,
    categories,
    products,
    groups,
    ordering: ordering.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    })),
    editor,
  };
}
