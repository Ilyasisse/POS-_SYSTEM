import { z } from "zod";

export const wasteInputSchema = z.object({
  supplyId: z.string().trim().min(1, "Choose a supply.").max(191),
  type: z.enum(["WASTE", "SPOILAGE", "DAMAGE"]),
  quantity: z
    .string()
    .regex(
      /^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/,
      "Enter a quantity with up to six decimal places.",
    )
    .refine(
      (value) => Number(value) > 0,
      "Quantity must be greater than zero.",
    ),
  reason: z
    .string()
    .trim()
    .min(3, "Explain what happened (at least 3 characters).")
    .max(200),
});

export function wasteStatusAlert(
  previous: "OK" | "LOW" | "OUT",
  next: "OK" | "LOW" | "OUT",
) {
  return next !== "OK" && next !== previous;
}
