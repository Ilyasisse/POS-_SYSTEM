import Link from "next/link";
import { PaymentMethod } from "@prisma/client";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier/cashier-business-day";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const money = (amount: number) => `$${amount.toFixed(2)}`;
const METHOD_LABEL: Record<PaymentMethod, string> = {
  MYCASH: "MyCash",
  GOLIS: "Golis",
  Dahabshiil: "Dahabshiil",
  OTHER: "Other (including cash)",
};

function getSelectedBusinessDayRange(daysBack: number) {
  return getCashierBusinessDayRange(
    new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000),
  );
}

export default async function CashierPaymentSummaryPage({
  searchParams,
}: {
  searchParams?: Promise<{ daysBack?: string }>;
}) {
  await requirePermission(PERMISSIONS.REPORT_STAFF_VIEW);
  const requested = (await searchParams)?.daysBack ?? "0";
  const daysBack = /^(?:[0-9]|[12][0-9]|30)$/.test(requested)
    ? Number(requested)
    : 0;
  const { start, end } = getSelectedBusinessDayRange(daysBack);
  const rows = await prisma.payment.groupBy({
    by: ["cashierId", "cashierName", "method"],
    where: { createdAt: { gte: start, lt: end } },
    _sum: { amountPaid: true },
    _count: { id: true },
  });

  const cashiers = new Map<
    string,
    {
      name: string;
      count: number;
      total: number;
      methods: Map<PaymentMethod, number>;
    }
  >();
  const methods = new Map<PaymentMethod, number>();
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const amount = Number(row._sum.amountPaid ?? 0);
    const key = row.cashierId ?? `legacy:${row.cashierName}`;
    const cashier = cashiers.get(key) ?? {
      name: row.cashierName || "Unassigned",
      count: 0,
      total: 0,
      methods: new Map<PaymentMethod, number>(),
    };
    cashier.count += row._count.id;
    cashier.total += amount;
    cashier.methods.set(
      row.method,
      (cashier.methods.get(row.method) ?? 0) + amount,
    );
    cashiers.set(key, cashier);
    methods.set(row.method, (methods.get(row.method) ?? 0) + amount);
    total += amount;
    count += row._count.id;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/manager" className="text-sm underline">
          ← Manager
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Cashier payment summary</h1>
        <p className="text-sm text-muted-foreground">
          Recorded payments for {formatCashierBusinessDayRange(start, end)}.
        </p>
      </header>
      <form method="get" className="flex items-center gap-3 text-sm">
        <label htmlFor="daysBack">Business day</label>
        <select
          id="daysBack"
          name="daysBack"
          defaultValue={String(daysBack)}
          className="h-10 rounded-md border bg-background px-3"
        >
          {Array.from({ length: 31 }, (_, offset) => (
            <option value={offset} key={offset}>
              {offset === 0
                ? "Current"
                : `${offset} day${offset === 1 ? "" : "s"} ago`}
            </option>
          ))}
        </select>
        <button
          className="rounded-md border px-3 py-2 font-semibold"
          type="submit"
        >
          Show
        </button>
      </form>
      <section className="rounded-xl border bg-background p-5">
        <h2 className="font-semibold">
          Total recorded: {money(total)} across {count} payment
          {count === 1 ? "" : "s"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Receipt totals are grouped by the cashier saved on each payment.
          Refunds, opening float, and drawer adjustments are not deducted. The
          legacy Other method can include cash and other tenders.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {Object.values(PaymentMethod).map((method) => (
            <li
              key={method}
              className="flex justify-between rounded-lg bg-muted/50 p-3 text-sm"
            >
              <span>{METHOD_LABEL[method]}</span>
              <strong>{money(methods.get(method) ?? 0)}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">By cashier</h2>
        {cashiers.size === 0 ? (
          <p className="rounded-lg border p-5 text-sm">
            No recorded payments for this business day.
          </p>
        ) : null}
        {[...cashiers.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .map(([id, cashier]) => (
            <div key={id} className="rounded-xl border bg-background p-5">
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold">
                  {cashier.name}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({cashier.count} payments)
                  </span>
                </h3>
                <strong>{money(cashier.total)}</strong>
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                {[...cashier.methods.entries()].map(([method, amount]) => (
                  <li key={method}>
                    {METHOD_LABEL[method]}: {money(amount)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>
    </main>
  );
}
