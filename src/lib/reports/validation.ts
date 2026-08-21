import { z } from "zod";

const optionalId = z.string().trim().min(1).max(191).optional();
export const reportQuerySchema = z.object({
  preset: z.enum(["today", "yesterday", "currentBusinessDay", "last7Days", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "custom"]).default("currentBusinessDay"),
  from: z.iso.date().optional(), to: z.iso.date().optional(), businessDate: z.iso.date().optional(),
  shiftId: optionalId, staffId: optionalId, waiterId: optionalId, cashierId: optionalId,
  station: optionalId, productId: optionalId, categoryId: optionalId, supplierId: optionalId,
  paymentMethod: optionalId, orderStatus: optionalId, tableId: optionalId, customerId: optionalId,
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().trim().max(100).optional(),
}).superRefine((value, context) => {
  if (value.preset === "custom" && (!value.from || !value.to)) context.addIssue({ code: "custom", message: "Custom reports require both from and to dates." });
  if (value.from && value.to && value.from > value.to) context.addIssue({ code: "custom", message: "The from date must not be after the to date." });
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export const parseReportSearchParams = (params: URLSearchParams) => reportQuerySchema.parse(Object.fromEntries(params.entries()));
