"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { marketingConsentChange } from "@/lib/customer/marketing-consent";
import { prisma } from "@/lib/prisma";

export async function changeMarketingEmailConsentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER" || !user.isActive) redirect("/customer");
  const intent = String(formData.get("intent") ?? "");
  if (intent !== "opt-in" && intent !== "withdraw")
    redirect("/customer/preferences?status=invalid");
  const changedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: user.id, isActive: true },
      select: { marketingEmailConsentAt: true },
    });
    if (!customer) return "unavailable";
    const change = marketingConsentChange(
      Boolean(customer.marketingEmailConsentAt),
      intent,
      changedAt,
    );
    if (!change.ok) return "invalid";
    if (!change.changed) return "unchanged";
    const updated = await tx.customer.updateMany({
      where: {
        id: user.id,
        isActive: true,
        marketingEmailConsentAt: intent === "opt-in" ? null : { not: null },
      },
      data: change.data,
    });
    if (updated.count !== 1) return "changed";
    await tx.auditLog.create({
      data: {
        actorCustomerId: user.id,
        action:
          intent === "opt-in"
            ? "customer.marketing_email.opted_in"
            : "customer.marketing_email.withdrawn",
        entityType: "Customer",
        entityId: user.id,
        reason:
          "Customer selected their promotional email preference in the account page.",
        previousValue: {
          marketingEmailConsentAt:
            customer.marketingEmailConsentAt?.toISOString() ?? null,
        },
        newValue: {
          marketingEmailConsentAt:
            change.data?.marketingEmailConsentAt?.toISOString() ?? null,
          marketingEmailRevokedAt:
            change.data?.marketingEmailRevokedAt?.toISOString() ?? null,
        },
      },
    });
    return "saved";
  });
  revalidatePath("/customer/preferences");
  redirect(`/customer/preferences?status=${result}`);
}
