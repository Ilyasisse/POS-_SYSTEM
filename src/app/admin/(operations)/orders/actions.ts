"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { emailOrderReceipt } from "@/lib/orders/email-receipt";

const emailReceiptInput = z.object({
  orderId: z.string().min(1),
  recipient: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
});

export async function emailReceiptFromAdmin(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.ORDER_VIEW_ALL);
  const parsed = emailReceiptInput.safeParse({
    orderId: formData.get("orderId"),
    recipient: formData.get("recipient"),
  });
  if (!parsed.success) redirect("/admin/orders?receiptStatus=invalid_email");

  let receiptStatus = "sent";
  try {
    const result = await emailOrderReceipt({
      ...parsed.data,
      actorUserId: actor.id,
    });
    if (result.status === "configuration_missing") {
      receiptStatus = "configuration_missing";
    }
  } catch (error) {
    console.error("Failed to email order receipt:", error);
    receiptStatus = "failed";
  }

  redirect(`/admin/orders?receiptStatus=${receiptStatus}`);
}
