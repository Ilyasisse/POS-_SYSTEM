import Link from "next/link";
import { randomUUID } from "node:crypto";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  formatCashierBusinessDayRange,
  getCashierBusinessDayRange,
} from "@/lib/cashier/cashier-business-day";
import { prisma } from "@/lib/prisma";
import { ToastOnMount } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordCashDrawerMovement } from "./actions";

export const dynamic = "force-dynamic";

const currency = (amount: number) => `$${amount.toFixed(2)}`;
const time = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

export default async function CashDrawerPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const { start } = getCashierBusinessDayRange();
  // Cashier order settlement excludes the 05:00–07:00 closeout window.
  // Drawer adjustments must still be visible during that window.
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const [movements, totals, params] = await Promise.all([
    prisma.cashDrawerMovement.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { recordedBy: { select: { fullName: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    }),
    prisma.cashDrawerMovement.groupBy({
      by: ["direction"],
      where: { createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    searchParams,
  ]);
  const inAmount = Number(
    totals.find((row) => row.direction === "IN")?._sum.amount ?? 0,
  );
  const outAmount = Number(
    totals.find((row) => row.direction === "OUT")?._sum.amount ?? 0,
  );
  const count = totals.reduce((sum, row) => sum + row._count.id, 0);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/manager" className="text-sm underline">
          ← Manager
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Cash drawer adjustments</h1>
        <p className="text-sm text-muted-foreground">
          Business day: {formatCashierBusinessDayRange(start, end)}. Record
          physical cash placed into or removed from the till outside sales.
        </p>
      </header>
      {params?.status === "recorded" ? (
        <ToastOnMount tone="success" description="Cash movement recorded." />
      ) : null}
      {params?.status === "invalid" ? (
        <ToastOnMount
          tone="error"
          description="Enter a valid direction, amount up to $1,000,000, and a reason of 3–250 characters."
        />
      ) : null}
      <form
        action={recordCashDrawerMovement}
        className="grid gap-4 rounded-xl border bg-background p-5 sm:grid-cols-4"
      >
        <input type="hidden" name="idempotencyKey" value={randomUUID()} />
        <label className="grid gap-2 text-sm font-medium">
          Direction
          <select
            name="direction"
            required
            className="h-10 rounded-md border bg-background px-2"
          >
            <option value="IN">Cash added</option>
            <option value="OUT">Cash removed</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Amount
          <Input
            name="amount"
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">
          Reason
          <Input
            name="reason"
            minLength={3}
            maxLength={250}
            required
            placeholder="Why was cash moved?"
          />
        </label>
        <div className="sm:col-span-4">
          <Button type="submit">Record movement</Button>
        </div>
      </form>
      <section className="space-y-3 rounded-xl border bg-background p-5">
        <h2 className="text-lg font-semibold">Today’s drawer movement</h2>
        <p className="text-sm">
          Added: {currency(inAmount)} · Removed: {currency(outAmount)} · Net:{" "}
          {currency(inAmount - outAmount)}
        </p>
        <p className="text-xs text-muted-foreground">
          These are cash adjustments only. Sales, opening float, and expenses
          are not included in this net amount.
        </p>
        {count > 50 ? (
          <p className="text-sm text-amber-800">
            Showing the latest 50 of {count} movements; totals include all
            movements today.
          </p>
        ) : null}
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cash adjustments recorded for this business day.
          </p>
        ) : null}
        <ul className="divide-y">
          {movements.map((movement) => (
            <li
              key={movement.id}
              className="flex flex-wrap justify-between gap-3 py-3 text-sm"
            >
              <div>
                <span className="font-semibold">
                  {movement.direction === "IN" ? "Added" : "Removed"}{" "}
                  {currency(Number(movement.amount))}
                </span>
                <p>{movement.reason}</p>
              </div>
              <span className="text-muted-foreground">
                {time.format(movement.createdAt)} ·{" "}
                {movement.recordedBy.fullName}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
