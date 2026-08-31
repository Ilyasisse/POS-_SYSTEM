import { Button, Card } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { ToastOnMount } from "@/components/ui/toast";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { allowedClockActions } from "@/lib/staff/clock-events";
import { recordOwnClockAction } from "./actions";

type MyAttendancePageProps = {
  searchParams?: Promise<{ attendanceStatus?: string }>;
};

const eventLabels = {
  IN: "Clocked in",
  BREAK_START: "Break started",
  BREAK_END: "Break ended",
  OUT: "Clocked out",
} as const;

export default async function MyAttendancePage({ searchParams }: MyAttendancePageProps) {
  const worker = await requirePermission(PERMISSIONS.ATTENDANCE_RECORD);
  const now = new Date();
  const [shifts, events, params] = await Promise.all([
    prisma.scheduledShift.findMany({ where: { workerId: worker.id, status: "SCHEDULED", endsAt: { gte: new Date(now.getTime() - 12 * 3_600_000) } }, orderBy: { startsAt: "asc" }, take: 5 }),
    prisma.clockEvent.findMany({ where: { workerId: worker.id }, orderBy: { occurredAt: "desc" }, take: 12 }),
    searchParams,
  ]);
  const actions = allowedClockActions(events[0]?.type ?? null);
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8"><div><p className="text-sm font-semibold text-emerald-700">Staff attendance</p><h1 className="text-3xl font-black">Hello, {worker.fullName}</h1><p className="text-slate-600">Clock events are append-only and use Nairobi business time.</p></div>
    {params?.attendanceStatus === "recorded" ? <ToastOnMount tone="success" description="Attendance event recorded." /> : null}
    {params?.attendanceStatus === "failed" ? <ToastOnMount tone="error" description="That attendance action is not allowed from your current state." /> : null}
    <Card className="p-5"><form action={recordOwnClockAction} className="grid gap-4"><label className="grid gap-1 text-sm font-semibold">Optional note<Input name="note" maxLength={250}/></label><div className="flex flex-wrap gap-2">{actions.map((action) => <Button key={action} type="submit" name="type" value={action} variant={action === "OUT" ? "outline" : "default"}>{action === "IN" ? "Clock in" : action === "OUT" ? "Clock out" : action === "BREAK_START" ? "Start break" : "End break"}</Button>)}</div></form></Card>
    <section className="grid gap-4 md:grid-cols-2"><Card className="p-5"><h2 className="font-bold">Upcoming shifts</h2><ul className="mt-3 space-y-3">{shifts.length ? shifts.map((shift) => <li key={shift.id} className="rounded-lg border p-3"><strong>{shift.station ?? "General"}</strong><div className="text-sm text-slate-600">{shift.startsAt.toLocaleString()} – {shift.endsAt.toLocaleString()}</div></li>) : <li className="text-sm text-slate-500">No upcoming shift.</li>}</ul></Card><Card className="p-5"><h2 className="font-bold">Recent clock events</h2><ol className="mt-3 space-y-2">{events.length ? events.map((event) => <li key={event.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><strong>{eventLabels[event.type]}</strong><span className="text-sm text-slate-600">{event.occurredAt.toLocaleString()}</span></div>{event.note ? <p className="mt-1 text-sm text-slate-500">{event.note}</p> : null}</li>) : <li className="text-sm text-slate-500">No clock events yet.</li>}</ol></Card></section>
  </main>;
}
