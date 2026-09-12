import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { mergeTableChecksAction } from "./actions";

type MergeChecksPageProps = {
  searchParams?: Promise<{ mergeStatus?: string }>;
};

async function loadEligibleChecks() {
  const checks = await prisma.tableCheck.findMany({
    where: {
      closedAt: null,
      orders: {
        some: { status: "OPEN" },
        every: { status: "OPEN", payments: { none: {} } },
      },
      table: {
        isActive: true,
        paymentRequests: {
          none: { status: { in: ["PENDING", "PARTIALLY_MATCHED"] } },
        },
        paymentDeferrals: { none: { resolvedAt: null } },
      },
    },
    select: {
      id: true,
      checkNumber: true,
      table: { select: { name: true } },
      orders: { select: { total: true } },
    },
    orderBy: [{ table: { name: "asc" } }, { createdAt: "asc" }],
  });
  return checks.map((check) => ({
    ...check,
    total: check.orders.reduce((sum, order) => sum + Number(order.total), 0),
  }));
}

function notice(status?: string) {
  if (status === "merged") {
    return { tone: "success" as const, message: "The checks were merged." };
  }
  if (status === "invalid") {
    return { tone: "error" as const, message: "Choose two different checks." };
  }
  if (status === "failed") {
    return {
      tone: "error" as const,
      message: "The checks changed or have payment activity and could not be merged.",
    };
  }
  return null;
}

export default async function MergeChecksPage({ searchParams }: MergeChecksPageProps) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);
  const [checks, params] = await Promise.all([loadEligibleChecks(), searchParams]);
  const message = notice(params?.mergeStatus);

  return (
    <main className="min-h-screen bg-muted/35 p-4 sm:p-6">
      {message ? <ToastOnMount tone={message.tone} description={message.message} /> : null}
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Merge table checks</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Move every round from one unpaid check into another check and table.
            </p>
          </div>
          <Button asChild variant="outline"><Link href="/cashier">Back to cashier</Link></Button>
        </header>

        <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          {checks.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              At least two unpaid checks without pending payments are required.
            </p>
          ) : (
            <form action={mergeTableChecksAction} className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Source check (will close)
                <NativeSelect name="sourceCheckId" required defaultValue="">
                  <option value="" disabled>Select source check</option>
                  {checks.map((check) => (
                    <option key={check.id} value={check.id}>
                      {check.table.name} · Check #{check.checkNumber} · ${check.total.toFixed(2)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Destination check (keeps its number)
                <NativeSelect name="destinationCheckId" required defaultValue="">
                  <option value="" disabled>Select destination check</option>
                  {checks.map((check) => (
                    <option key={check.id} value={check.id}>
                      {check.table.name} · Check #{check.checkNumber} · ${check.total.toFixed(2)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                The destination table and check number will be used for all moved rounds. Pending or partially completed payments block the merge.
              </p>
              <Button type="submit" className="w-fit">Merge checks</Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
