import Link from "next/link";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToastOnMount } from "@/components/ui/toast";
import { closeRegisterShift, openRegisterShift } from "./actions";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});
const money = (value: number) => `$${value.toFixed(2)}`;

export default async function RegisterShiftPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const [staff, params] = await Promise.all([
    requirePermission(PERMISSIONS.PAYMENT_TAKE),
    searchParams,
  ]);
  const shifts = await prisma.cashierRegisterShift.findMany({
    where: { cashierId: staff.id },
    orderBy: { openedAt: "desc" },
    take: 10,
  });
  const active = shifts.find((shift) => shift.closedAt === null);
  const message = {
    opened: "Register shift is open.",
    closed: "Closing cash count saved.",
    invalid:
      "Enter a valid cash count up to $1,000,000 and a note under 500 characters.",
    "already-closed":
      "This shift was already closed or no longer belongs to you.",
  }[params?.status ?? ""];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/cashier" className="text-sm underline">
          ← Cashier
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Your register shift</h1>
        <p className="text-sm text-muted-foreground">
          Record the physical cash you count when you open and close your
          register.
        </p>
      </header>
      {message ? (
        <ToastOnMount
          tone={
            params?.status === "invalid" || params?.status === "already-closed"
              ? "error"
              : "success"
          }
          description={message}
        />
      ) : null}
      {active ? (
        <section className="space-y-4 rounded-xl border bg-background p-5">
          <h2 className="font-semibold">
            Open since {when.format(active.openedAt)}
          </h2>
          <p>Opening cash counted: {money(Number(active.openingCash))}</p>
          <form action={closeRegisterShift} className="space-y-4">
            <input type="hidden" name="shiftId" value={active.id} />
            <label className="grid gap-2 text-sm font-medium">
              Physical closing cash count
              <Input
                name="closingCash"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Closing note (optional)
              <Input
                name="closingNote"
                maxLength={500}
                placeholder="Explain anything the next cashier should know"
              />
            </label>
            <Button type="submit">Close shift and save count</Button>
          </form>
        </section>
      ) : (
        <form
          action={openRegisterShift}
          className="space-y-4 rounded-xl border bg-background p-5"
        >
          <h2 className="font-semibold">Open a shift</h2>
          <label className="grid gap-2 text-sm font-medium">
            Physical opening cash count
            <Input
              name="openingCash"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              required
            />
          </label>
          <Button type="submit">Open shift</Button>
        </form>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent shifts</h2>
        {shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No register shifts recorded yet.
          </p>
        ) : null}
        <ul className="divide-y rounded-xl border bg-background px-5">
          {shifts.map((shift) => (
            <li key={shift.id} className="py-3 text-sm">
              <strong>
                {when.format(shift.openedAt)} —{" "}
                {shift.closedAt ? when.format(shift.closedAt) : "Open"}
              </strong>
              <p>
                Opening {money(Number(shift.openingCash))} · Closing{" "}
                {shift.closingCash === null
                  ? "Pending"
                  : money(Number(shift.closingCash))}
              </p>
              {shift.closingNote ? (
                <p className="text-muted-foreground">{shift.closingNote}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          These are counted cash snapshots, not a calculated till balance.
          Sales, refunds, cash movements, and waiter balances are tracked
          separately.
        </p>
      </section>
    </main>
  );
}
