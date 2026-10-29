import { z } from "zod";

export const catalogKinds = [
  "products",
  "categories",
  "modifiers",
  "modifier-groups",
] as const;
export type CatalogKind = (typeof catalogKinds)[number];
export const catalogLabels: Record<
  CatalogKind,
  { title: string; singular: string; description: string }
> = {
  products: {
    title: "Products",
    singular: "product",
    description: "Your menu, prices and sale availability.",
  },
  categories: {
    title: "Categories",
    singular: "category",
    description: "Organize the menu and route items to the kitchen.",
  },
  modifiers: {
    title: "Modifiers",
    singular: "modifier",
    description: "Extra choices, linked products and additional prices.",
  },
  "modifier-groups": {
    title: "Modifier groups",
    singular: "modifier group",
    description: "Set clear selection rules for each product.",
  },
};
export const stations = [
  "CUNTO_SOOMAALI",
  "FAST_FOOD",
  "CABITAAN",
  "BARISTA",
] as const;
export const stationLabels: Record<string, string> = {
  CUNTO_SOOMAALI: "Cunto Soomaali",
  FAST_FOOD: "Fast food",
  CABITAAN: "Cabitaan",
  BARISTA: "Barista",
};
export type CatalogOption = { id: string; name: string };
export type LinkedOption = CatalogOption & {
  productId: string;
  productName: string;
  price: number;
  isActive: boolean;
};
export type CatalogRecord = CatalogOption & {
  updatedAt: string;
  isActive: boolean;
  price?: number;
  categoryId?: string;
  categoryName?: string;
  categoryActive?: boolean;
  imageUrl?: string | null;
  description?: string | null;
  pronunciationAudioUrl?: string | null;
  trackStock?: boolean;
  stockQty?: number;
  availableForSale?: boolean;
  availabilityReason?: string | null;
  availabilityRestoresAt?: string | null;
  isPopular?: boolean;
  station?: string | null;
  sortOrder?: number;
  productCount?: number;
  productId?: string;
  productName?: string;
  modifierGroupId?: string;
  groupName?: string;
  isRequired?: boolean;
  minSelect?: number;
  maxSelect?: number;
  options?: LinkedOption[];
};
export type CategoryVersion = {
  id: string;
  sortOrder: number;
  updatedAt: string;
};
export type CatalogData = {
  kind: CatalogKind;
  rows: CatalogRecord[];
  total: number;
  page: number;
  pages: number;
  params: Record<string, string>;
  categories: CatalogOption[];
  products: CatalogOption[];
  groups: CatalogOption[];
  ordering: CategoryVersion[];
  editor: CatalogRecord | "new" | null;
};
export type CatalogResult =
  | { ok: true; message: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const id = z.string().trim().min(1, "Choose an item.").max(128);
const text = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(120, "Use 120 characters or fewer.");
const amount = z
  .string()
  .trim()
  .min(1, "Enter a price.")
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Use a positive price with up to two decimal places.",
  )
  .transform(Number)
  .pipe(z.number().finite().min(0).max(1_000_000));
const integer = z
  .string()
  .trim()
  .regex(/^\d+$/, "Enter a whole number of zero or more.")
  .transform(Number)
  .pipe(z.number().int().max(1_000_000));
const checkbox = z.enum(["on", "off"]).transform((v) => v === "on");
const asset = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    if (!v) return true;
    if (/[\\\u0000-\u001f]/.test(v)) return false;
    if (v.startsWith("/") && !v.startsWith("//")) return true;
    try {
      const url = new URL(v);
      return ["http:", "https:"].includes(url.protocol) && !!url.hostname;
    } catch {
      return false;
    }
  }, "Use a local path or an HTTP(S) URL.");
const base = { name: text, isActive: checkbox };
const availabilityFields = {
  availableForSale: checkbox,
  availabilityReason: z
    .string()
    .trim()
    .max(200, "Use 200 characters or fewer."),
  durationMinutes: z.enum(["keep", "", "60", "180", "720", "1440"]),
};
function validatePause(
  value: { availableForSale: boolean; availabilityReason: string },
  ctx: z.RefinementCtx,
) {
  if (!value.availableForSale && value.availabilityReason.length < 3)
    ctx.addIssue({
      code: "custom",
      path: ["availabilityReason"],
      message: "Give a reason of at least 3 characters.",
    });
}
const productSchema = z
  .object({
    ...base,
    price: amount,
    categoryId: id,
    trackStock: checkbox,
    imageUrl: asset,
    description: z.string().trim().max(2000),
    pronunciationAudioUrl: asset,
    isPopular: checkbox,
    ...availabilityFields,
  })
  .superRefine(validatePause);
const categorySchema = z.object({
  ...base,
  station: z.enum(["", ...stations]),
  sortOrder: integer,
});
const modifierSchema = z.object({
  ...base,
  price: amount,
  productIds: z.array(id).min(1, "Select at least one product.").max(500),
  modifierGroupId: id,
  pronunciationAudioUrl: asset,
});
const groupSchema = z
  .object({
    ...base,
    isRequired: checkbox,
    minSelect: integer,
    maxSelect: integer,
  })
  .superRefine((v, ctx) => {
    if (v.maxSelect < 1)
      ctx.addIssue({
        code: "custom",
        path: ["maxSelect"],
        message: "Maximum must be at least 1.",
      });
    if (v.minSelect > v.maxSelect)
      ctx.addIssue({
        code: "custom",
        path: ["minSelect"],
        message: "Minimum cannot exceed maximum.",
      });
    if (v.isRequired && v.minSelect < 1)
      ctx.addIssue({
        code: "custom",
        path: ["minSelect"],
        message: "Required groups need a minimum of at least 1.",
      });
    if (!v.isRequired && v.minSelect !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["minSelect"],
        message: "Optional groups must have a minimum of 0.",
      });
  });
export const catalogSchemas = {
  products: productSchema,
  categories: categorySchema,
  modifiers: modifierSchema,
  "modifier-groups": groupSchema,
};
export const availabilitySchema = z
  .object({ id, ...availabilityFields })
  .superRefine(validatePause);
export const identitySchema = z.object({ id, updatedAt: z.iso.datetime() });

export function catalogFormValues(data: FormData) {
  const values: Record<string, unknown> = Object.fromEntries(data.entries());
  for (const key of [
    "isActive",
    "trackStock",
    "isPopular",
    "isRequired",
    "availableForSale",
  ])
    values[key] = data.get(key) ?? "off";
  values.productIds = [
    ...new Set(
      data
        .getAll("productIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
  return values;
}
export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [
      String(issue.path[0] ?? "form"),
      issue.message,
    ]),
  );
}
export function selectionRule(minimum = 0, maximum = 1) {
  if (minimum === maximum) return `Choose exactly ${minimum}`;
  if (minimum === 0) return `Choose up to ${maximum} (optional)`;
  return `Choose ${minimum}–${maximum}`;
}
export function priceLabel(price = 0) {
  return price === 0 ? "Included" : `+$${price.toFixed(2)}`;
}
export function saleAvailable(row: CatalogRecord, now = Date.now()) {
  return (
    row.availableForSale === true ||
    (row.availabilityRestoresAt != null &&
      Date.parse(row.availabilityRestoresAt) <= now)
  );
}
export function orderingMatches(
  expected: CategoryVersion[],
  actual: CategoryVersion[],
) {
  return (
    expected.length === actual.length &&
    expected.every(
      (row, i) =>
        row.id === actual[i].id &&
        row.sortOrder === actual[i].sortOrder &&
        row.updatedAt === actual[i].updatedAt,
    )
  );
}
export function reorderIds(ids: string[], from: string, to: string) {
  const result = [...ids];
  const source = result.indexOf(from),
    target = result.indexOf(to);
  if (source < 0 || target < 0) return result;
  result.splice(target, 0, ...result.splice(source, 1));
  return result;
}
