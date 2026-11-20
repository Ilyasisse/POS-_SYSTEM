import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import {
  SHIFT_BROWSER_PAGE_SIZE,
  shiftBrowserPage,
} from "@/lib/staff/shift-browser-page";
import { cancelScheduleAction, createScheduleAction } from "../actions";

const label = "grid gap-1 text-sm font-semibold text-foreground";

export default async function StaffSchedulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; worker?: string; page?: string }>;
}) {
  await requirePermission(PERMISSIONS.ATTENDANCE_SCHEDULE);
  const now = new Date();
  const params = await searchParams;
  const view = normalizeFilterChoice(
    params?.view,
    ["upcoming", "recent"] as const,
    "upcoming",
  );
  const staff = await prisma.staff.findMany({
    where: { role: { not: "SUPPLIER" }, isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
  const worker = staff.some((member) => member.id === params?.worker)
    ? params?.worker
    : undefined;
  const where: Prisma.ScheduledShiftWhereInput = {
    ...(worker ? { workerId: worker } : {}),
    ...(view === "upcoming"
      ? { endsAt: { gte: now } }
      : { endsAt: { gte: new Date(now.getTime() - 7 * 86_400_000), lt: now } }),
  };
  const total = await prisma.scheduledShift.count({ where });
  const pagination = shiftBrowserPage(params?.page, total);
  const shifts = await prisma.scheduledShift.findMany({
    where,
    include: { worker: { select: { fullName: true } } },
    orderBy: [
      { startsAt: view === "upcoming" ? "asc" : "desc" },
      { id: "asc" },
    ],
    skip: pagination.skip,
    take: SHIFT_BROWSER_PAGE_SIZE,
  });

  function pageHref(page: number) {
    const query = new URLSearchParams();
    if (view !== "upcoming") query.set("view", view);
    if (worker) query.set("worker", worker);
    query.set("page", String(page));
    return `/admin/staff/schedules?${query.toString()}`;
  }
  return (
    <AdminPage
      title="Staff schedules"
      description="Create station shifts; overlapping active shifts are rejected."
    >
      <Card className="p-5">
        <form
          action={createScheduleAction}
          className="grid gap-4 md:grid-cols-4"
        >
          <label className={label}>
            Worker
            <select
              name="workerId"
              required
              className="h-9 rounded-lg border px-3"
            >
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Starts
            <Input name="startsAt" type="datetime-local" required />
          </label>
          <label className={label}>
            Ends
            <Input name="endsAt" type="datetime-local" required />
          </label>
          <label className={label}>
            Station
            <select name="station" className="h-9 rounded-lg border px-3">
              <option value="">General</option>
              <option value="CUNTO_SOOMAALI">Cunto Soomaali</option>
              <option value="FAST_FOOD">Fast food</option>
              <option value="BARISTA">Barista</option>
              <option value="CABITAAN">Cabitaan</option>
            </select>
          </label>
          <div className="md:col-span-4">
            <Button type="submit">Create shift</Button>
          </div>
        </form>
      </Card>
      <DataTableCard
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Showing {total === 0 ? 0 : pagination.skip + 1} to{" "}
              {Math.min(pagination.skip + shifts.length, total)} of {total}{" "}
              shifts
            </span>
            {pagination.pageCount > 1 ? (
              <nav
                aria-label="Shift schedule pages"
                className="flex items-center gap-3"
              >
                {pagination.page > 1 ? (
                  <Link prefetch={false} href={pageHref(pagination.page - 1)}>
                    Previous
                  </Link>
                ) : null}
                <span>
                  Page {pagination.page} of {pagination.pageCount}
                </span>
                {pagination.page < pagination.pageCount ? (
                  <Link prefetch={false} href={pageHref(pagination.page + 1)}>
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        }
      >
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 p-4 text-sm"
        >
          <label className="grid gap-1 font-semibold">
            View
            <select
              name="view"
              defaultValue={view}
              className="rounded-lg border px-3 py-2"
            >
              <option value="upcoming">Upcoming and in progress</option>
              <option value="recent">Ended in last 7 days</option>
            </select>
          </label>
          <label className="grid gap-1 font-semibold">
            Worker
            <select
              name="worker"
              defaultValue={worker ?? ""}
              className="rounded-lg border px-3 py-2"
            >
              <option value="">All workers</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm">
            Filter
          </Button>
        </form>
        <Table>
          <thead>
            <tr>
              <TableHead>Worker</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Station</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {shifts.length ? (
              shifts.map((shift) => (
                <tr key={shift.id}>
                  <TableCell className="font-semibold">
                    {shift.worker.fullName}
                  </TableCell>
                  <TableCell>{shift.startsAt.toLocaleString()}</TableCell>
                  <TableCell>{shift.endsAt.toLocaleString()}</TableCell>
                  <TableCell>{shift.station ?? "General"}</TableCell>
                  <TableCell>
                    <ToneBadge
                      tone={
                        shift.status === "SCHEDULED"
                          ? "blue"
                          : shift.status === "COMPLETED"
                            ? "green"
                            : "slate"
                      }
                    >
                      {shift.status}
                    </ToneBadge>
                  </TableCell>
                  <TableCell>
                    {shift.status === "SCHEDULED" ? (
                      <form action={cancelScheduleAction}>
                        <input type="hidden" name="shiftId" value={shift.id} />
                        <input
                          type="hidden"
                          name="reason"
                          value="Cancelled by schedule manager"
                        />
                        <Button size="sm" variant="outline">
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={6} className="py-10 text-center">
                  No shifts scheduled.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
