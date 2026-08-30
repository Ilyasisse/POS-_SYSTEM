import { Button, Card } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { recordOwnClockAction } from "./actions";

export default async function MyAttendancePage() {
  const worker = await requirePermission(PERMISSIONS.ATTENDANCE_RECORD);
  const now = new Date();
  const [shifts, events] = await Promise.all([
    prisma.scheduledShift.findMany({ where: { workerId: worker.id, status: "SCHEDULED", endsAt: { gte: new Date(now.getTime() - 12 * 3_600_000) } }, orderBy: { startsAt: "asc" }, take: 5 }),
    prisma.clockEvent.findMany({ where: { workerId: worker.id }, orderBy: { occurredAt: "desc" }, take: 12 }),
  ]);
  const nextType = events[0]?.type === "IN" ? "OUT" : "IN";
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8"><div><p className="text-sm font-semibold text-emerald-700">Staff attendance</p><h1 className="text-3xl font-black">Hello, {worker.fullName}</h1><p className="text-slate-600">Clock events are append-only and use Nairobi business time.</p></div>
    <Card className="p-5"><form action={recordOwnClockAction} className="grid gap-4 sm:grid-cols-[1fr_auto]"><input type="hidden" name="type" value={nextType}/><label className="grid gap-1 text-sm font-semibold">Optional note<Input name="note" maxLength={250}/></label><Button type="submit" className="self-end">Clock {nextType === "IN" ? "in" : "out"}</Button></form></Card>
    <section className="grid gap-4 md:grid-cols-2"><Card className="p-5"><h2 className="font-bold">Upcoming shifts</h2><ul className="mt-3 space-y-3">{shifts.length ? shifts.map((shift) => <li key={shift.id} className="rounded-lg border p-3"><strong>{shift.station ?? "General"}</strong><div className="text-sm text-slate-600">{shift.startsAt.toLocaleString()} – {shift.endsAt.toLocaleString()}</div></li>) : <li className="text-sm text-slate-500">No upcoming shift.</li>}</ul></Card><Card className="p-5"><h2 className="font-bold">Recent clock events</h2><ol className="mt-3 space-y-2">{events.length ? events.map((event) => <li key={event.id} className="flex justify-between rounded-lg border p-3"><strong>{event.type}</strong><span className="text-sm text-slate-600">{event.occurredAt.toLocaleString()}</span></li>) : <li className="text-sm text-slate-500">No clock events yet.</li>}</ol></Card></section>
  </main>;
}
