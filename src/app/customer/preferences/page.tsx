import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ToastOnMount } from "@/components/ui/toast";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { changeMarketingEmailConsentAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CustomerPreferencesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER" || !user.isActive) redirect("/customer");
  const customer = await prisma.customer.findUnique({
    where: { id: user.id },
    select: { marketingEmailConsentAt: true },
  });
  if (!customer) redirect("/login");
  const query = (await searchParams) ?? {};
  const consented = Boolean(customer.marketingEmailConsentAt);
  const feedback = {
    saved: {
      tone: "success" as const,
      message: "Your email preference was saved.",
    },
    unchanged: {
      tone: "info" as const,
      message: "Your email preference is already up to date.",
    },
    changed: {
      tone: "warning" as const,
      message:
        "Your preference changed in another session. Refresh before trying again.",
    },
    unavailable: {
      tone: "error" as const,
      message: "Your account could not be updated. Sign in again.",
    },
    invalid: {
      tone: "error" as const,
      message: "Choose a valid email preference.",
    },
  };
  const notice =
    query.status && query.status in feedback
      ? feedback[query.status as keyof typeof feedback]
      : null;

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-10 text-stone-950">
      <div className="mx-auto max-w-lg space-y-6 rounded-2xl bg-white p-6 shadow-sm">
        <Link href="/customer" className="text-sm text-amber-800 underline">
          Back to menu
        </Link>
        <h1 className="text-2xl font-bold">Email preferences</h1>
        {notice ? (
          <ToastOnMount tone={notice.tone} description={notice.message} />
        ) : null}
        <p className="text-sm">
          Promotional email: <strong>{consented ? "Allowed" : "Off"}</strong>
        </p>
        <p className="text-sm text-stone-700">
          If you agree, Mash Allah Cafe may send offers and café updates to your
          account email. Your choice does not affect order receipts or service
          messages. You can withdraw it here at any time.
        </p>
        <form action={changeMarketingEmailConsentAction}>
          <input
            type="hidden"
            name="intent"
            value={consented ? "withdraw" : "opt-in"}
          />
          <Button type="submit" variant={consented ? "outline" : "default"}>
            {consented
              ? "Stop promotional emails"
              : "Agree to promotional emails"}
          </Button>
        </form>
      </div>
    </main>
  );
}
