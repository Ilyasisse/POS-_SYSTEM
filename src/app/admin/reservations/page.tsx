import {
  AdminPage,
  Button,
  Card,
  MetricCard,
  ToneBadge,
} from "@/components/admin/shared";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  createReservationAction,
  transitionReservationAction,
} from "./actions";

type ReservationsPageProps = {
  searchParams?: Promise<{ reservationStatus?: string }>;
};

const ACTIVE_STATUSES = ["BOOKED", "WAITING", "SEATED"] as const;

function notice(status?: string) {
  switch (status) {
    case "created":
      return { tone: "success" as const, message: "Guest entry created." };
    case "updated":
      return { tone: "success" as const, message: "Guest status updated." };
    case "invalid":
      return {
        tone: "error" as const,
        message: "Check the guest, party size, and reservation time.",
      };
    case "invalid_transition":
      return { tone: "error" as const, message: "That status change is invalid." };
    case "transition_failed":
      return {
        tone: "warning" as const,
        message: "The guest could not be updated. Confirm the table is still available.",
      };
    case "failed":
      return { tone: "error" as const, message: "The guest entry could not be created." };
    default:
      return null;
  }
}

function statusTone(status: string) {
  if (status === "SEATED" || status === "COMPLETED") return "green" as const;
  if (status === "WAITING") return "amber" as const;
  if (status === "CANCELLED" || status === "NO_SHOW") return "red" as const;
  return "blue" as const;
}

async function loadReservationsPageData() {
  const now = Date.now();
  const recentCutoff = new Date(now - 7 * 24 * 60 * 60_000);
  const defaultScheduledAt = new Date(now + 4 * 60 * 60_000)
    .toISOString()
    .slice(0, 16);

  const [reservations, availableTables] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        OR: [
          { status: { in: [...ACTIVE_STATUSES] } },
          { createdAt: { gte: recentCutoff } },
        ],
      },
      include: {
        table: { select: { id: true, name: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: [{ status: "asc" }, { scheduledAt: "asc" }, { createdAt: "asc" }],
      take: 100,
    }),
    prisma.table.findMany({
      where: {
        isActive: true,
        orders: { none: { status: "OPEN" } },
        reservations: { none: { status: "SEATED" } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { reservations, availableTables, defaultScheduledAt };
}

export default async function ReservationsPage({
  searchParams,
}: ReservationsPageProps) {
  await requirePermission(PERMISSIONS.TABLE_MANAGE);
  const params = await searchParams;
  const message = notice(params?.reservationStatus);
  const { reservations, availableTables, defaultScheduledAt } =
    await loadReservationsPageData();

  const counts = Object.fromEntries(
    ACTIVE_STATUSES.map((status) => [
      status,
      reservations.filter((entry) => entry.status === status).length,
    ]),
  );

  return (
    <AdminPage
      title="Reservations & waitlist"
      description="Book future guests, track walk-ins, and seat parties at available tables."
    >
      {message ? (
        <ToastOnMount tone={message.tone} description={message.message} />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Booked" value={counts.BOOKED ?? 0} />
        <MetricCard label="Waiting" value={counts.WAITING ?? 0} />
        <MetricCard label="Seated" value={counts.SEATED ?? 0} />
      </section>

      <Card className="p-5">
        <h2 className="text-lg font-black">Add guest</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose reservation for a future arrival or waitlist for a walk-in.
        </p>
        <form
          action={createReservationAction}
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          <label className="grid gap-1 text-sm font-bold">
            Entry type
            <NativeSelect name="kind" defaultValue="RESERVATION">
              <option value="RESERVATION">Reservation</option>
              <option value="WAITLIST">Walk-in waitlist</option>
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Guest name
            <Input name="guestName" maxLength={120} required />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Phone
            <Input name="phone" type="tel" maxLength={40} />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Party size
            <Input name="partySize" type="number" min={1} max={50} required />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Reservation time
            <Input
              name="scheduledAt"
              type="datetime-local"
              defaultValue={defaultScheduledAt}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold xl:col-span-3">
            Notes
            <Textarea name="notes" maxLength={1000} />
          </label>
          <Button type="submit" className="w-fit">
            Add guest
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-black">Guest queue</h2>
        <div className="mt-4 grid gap-3">
          {reservations.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
              No reservations or waiting guests.
            </p>
          ) : (
            reservations.map((entry) => (
              <article key={entry.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black">{entry.guestName}</h3>
                      <ToneBadge tone={statusTone(entry.status)}>
                        {entry.status.replaceAll("_", " ")}
                      </ToneBadge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Party of {entry.partySize}
                      {entry.phone ? ` · ${entry.phone}` : ""}
                      {entry.scheduledAt
                        ? ` · ${entry.scheduledAt.toLocaleString("en-US", {
                            timeZone: "Africa/Nairobi",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}`
                        : " · Walk-in"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Added by {entry.createdBy.fullName}
                      {entry.table ? ` · ${entry.table.name}` : ""}
                    </p>
                    {entry.notes ? (
                      <p className="mt-2 text-sm text-slate-700">{entry.notes}</p>
                    ) : null}
                  </div>

                  {ACTIVE_STATUSES.includes(
                    entry.status as (typeof ACTIVE_STATUSES)[number],
                  ) ? (
                    <div className="flex max-w-xl flex-wrap justify-end gap-2">
                      {entry.status === "BOOKED" ? (
                        <StatusButton id={entry.id} status="WAITING">
                          Add to waitlist
                        </StatusButton>
                      ) : null}
                      {entry.status === "BOOKED" || entry.status === "WAITING" ? (
                        <form
                          action={transitionReservationAction}
                          className="flex gap-2"
                        >
                          <input type="hidden" name="reservationId" value={entry.id} />
                          <input type="hidden" name="nextStatus" value="SEATED" />
                          <NativeSelect name="tableId" required defaultValue="">
                            <option value="" disabled>
                              Select table
                            </option>
                            {availableTables.map((table) => (
                              <option key={table.id} value={table.id}>
                                {table.name}
                              </option>
                            ))}
                          </NativeSelect>
                          <Button type="submit" disabled={availableTables.length === 0}>
                            Seat
                          </Button>
                        </form>
                      ) : null}
                      {entry.status === "SEATED" ? (
                        <StatusButton id={entry.id} status="COMPLETED">
                          Complete visit
                        </StatusButton>
                      ) : null}
                      {entry.status === "BOOKED" ? (
                        <StatusButton id={entry.id} status="NO_SHOW" variant="outline">
                          No-show
                        </StatusButton>
                      ) : null}
                      {entry.status !== "SEATED" ? (
                        <StatusButton id={entry.id} status="CANCELLED" variant="outline">
                          Cancel
                        </StatusButton>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </Card>
    </AdminPage>
  );
}

function StatusButton({
  id,
  status,
  children,
  variant,
}: {
  id: string;
  status: string;
  children: ReactNode;
  variant?: "outline";
}) {
  return (
    <form action={transitionReservationAction}>
      <input type="hidden" name="reservationId" value={id} />
      <input type="hidden" name="nextStatus" value={status} />
      <Button type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}
