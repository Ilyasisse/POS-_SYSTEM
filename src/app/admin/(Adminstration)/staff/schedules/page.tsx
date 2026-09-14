import { AdminPage, Button, Card, DataTableCard, Table, TableCell, TableHead, ToneBadge } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { cancelScheduleAction, createScheduleAction } from "../actions";

const label = "grid gap-1 text-sm font-semibold text-slate-700";

export default async function StaffSchedulesPage() {
  await requirePermission(PERMISSIONS.ATTENDANCE_SCHEDULE);
  const now = new Date();
  const [staff, shifts] = await Promise.all([
    prisma.user.findMany({ where: { role: { notIn: ["CUSTOMER", "SUPPLIER"] }, isActive: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.scheduledShift.findMany({ where: { endsAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } }, include: { worker: { select: { fullName: true } } }, orderBy: { startsAt: "asc" }, take: 100 }),
  ]);
  return <AdminPage title="Staff schedules" description="Create station shifts; overlapping active shifts are rejected.">
    <Card className="p-5"><form action={createScheduleAction} className="grid gap-4 md:grid-cols-4">
      <label className={label}>Worker<select name="workerId" required className="h-9 rounded-lg border px-3">{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}</select></label>
      <label className={label}>Starts<Input name="startsAt" type="datetime-local" required /></label>
      <label className={label}>Ends<Input name="endsAt" type="datetime-local" required /></label>
      <label className={label}>Station<select name="station" className="h-9 rounded-lg border px-3"><option value="">General</option><option value="CUNTO_SOOMAALI">Cunto Soomaali</option><option value="FAST_FOOD">Fast food</option><option value="BARISTA">Barista</option><option value="CABITAAN">Cabitaan</option></select></label>
      <div className="md:col-span-4"><Button type="submit">Create shift</Button></div>
    </form></Card>
    <DataTableCard><Table><thead><tr><TableHead>Worker</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Station</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></tr></thead><tbody>{shifts.length ? shifts.map((shift) => <tr key={shift.id}><TableCell className="font-semibold">{shift.worker.fullName}</TableCell><TableCell>{shift.startsAt.toLocaleString()}</TableCell><TableCell>{shift.endsAt.toLocaleString()}</TableCell><TableCell>{shift.station ?? "General"}</TableCell><TableCell><ToneBadge tone={shift.status === "SCHEDULED" ? "blue" : shift.status === "COMPLETED" ? "green" : "slate"}>{shift.status}</ToneBadge></TableCell><TableCell>{shift.status === "SCHEDULED" ? <form action={cancelScheduleAction}><input type="hidden" name="shiftId" value={shift.id}/><input type="hidden" name="reason" value="Cancelled by schedule manager"/><Button size="sm" variant="outline">Cancel</Button></form> : "—"}</TableCell></tr>) : <tr><TableCell colSpan={6} className="py-10 text-center">No shifts scheduled.</TableCell></tr>}</tbody></Table></DataTableCard>
  </AdminPage>;
}
