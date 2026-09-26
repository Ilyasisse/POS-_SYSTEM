import { z } from "zod";

const optionalId = z
  .string()
  .trim()
  .max(191)
  .transform((value) => value || null);

export const complaintInput = z.object({
  category: z.enum(["SERVICE", "FOOD", "PAYMENT", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().trim().min(10).max(2000),
  orderId: optionalId,
});

export const complaintAssignmentInput = z.object({
  complaintId: z.string().trim().min(1).max(191),
  assigneeId: z.string().trim().min(1).max(191),
});

export const complaintResolutionInput = z.object({
  complaintId: z.string().trim().min(1).max(191),
  resolutionNotes: z.string().trim().min(10).max(2000),
});
