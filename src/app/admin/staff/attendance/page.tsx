import { AdminPage, Button, Card, DataTableCard, MetricCard, Table, TableCell, TableHead, ToneBadge } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { approveAttendanceAction, saveAttendancePolicyAction } from "../actions";

const label = "grid gap-1 text-sm font-semibold text-slate-700";

export default async function AttendanceAdminPage() {
  await requirePermission(PERMISSIONS.ATTENDANCE_APPROVE);
  const [policy, shifts, records] = await Promise.all([
    prisma.attendancePolicy.findUnique({ where: { id: "default" } }),
    prisma.scheduledShift.findMany({ where: { status: "SCHEDULED", startsAt: { lte: new Date() } }, include: { worker: { select: { fullName: true } }, attendance: true }, orderBy: { startsAt: "desc" }, take: 50 }),
    prisma.attendanceRecord.findMany({ include: { worker: { select: { fullName: true } } }, orderBy: { businessDate: "desc" }, take: 50 }),
  ]);
  const pending = shifts.filter((shift) => !shift.attendance);
  return <AdminPage title="Attendance approval" description="Review clock evidence, lateness, absence and approved overtime.">
    <section className="grid gap-4 sm:grid-cols-3"><MetricCard label="Awaiting review" value={pending.length}/><MetricCard label="Approved present" value={records.filter((row) => row.status === "PRESENT").length}/><MetricCard label="Recorded absences" value={records.filter((row) => row.status === "ABSENT").length}/></section>
    <Card className="p-5"><h2 className="mb-4 font-bold">Attendance policy</h2><form action={saveAttendancePolicyAction} className="grid gap-4 md:grid-cols-4"><label className={label}>Shift minutes<Input name="shiftMinutes" type="number" min="60" max="1440" defaultValue={policy?.shiftMinutes ?? 480}/></label><label className={label}>Grace minutes<Input name="graceMinutes" type="number" min="0" max="120" defaultValue={policy?.graceMinutes ?? 10}/></label><label className={label}>Overtime threshold<Input name="overtimeThresholdMinutes" type="number" min="0" max="480" defaultValue={policy?.overtimeThresholdMinutes ?? 30}/></label><Button className="self-end" type="submit">Save policy</Button></form></Card>
    <Card className="p-5"><h2 className="mb-4 font-bold">Shifts awaiting approval</h2><div className="space-y-4">{pending.length ? pending.map((shift) => <form action={approveAttendanceAction} key={shift.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-5"><input type="hidden" name="shiftId" value={shift.id}/><div><strong>{shift.worker.fullName}</strong><div className="text-xs text-slate-500">{shift.startsAt.toLocaleString()}</div></div><label className={label}>Status<select name="status" className="h-9 rounded-lg border px-3"><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="REJECTED">Rejected evidence</option></select></label><label className={label}>Approved overtime<Input name="approvedOvertimeMinutes" type="number" min="0" max="1440" defaultValue="0"/></label><label className={label}>Absence/correction note<Input name="absenceReason" maxLength={500}/></label><Button className="self-end" type="submit">Approve</Button></form>) : <p className="text-sm text-slate-500">No shifts await approval.</p>}</div></Card>
    <DataTableCard><Table><thead><tr><TableHead>Business date</TableHead><TableHead>Worker</TableHead><TableHead>Status</TableHead><TableHead>Worked</TableHead><TableHead>Late</TableHead><TableHead>Overtime</TableHead></tr></thead><tbody>{records.length ? records.map((record) => <tr key={record.id}><TableCell>{record.businessDate.toLocaleDateString()}</TableCell><TableCell className="font-semibold">{record.worker.fullName}</TableCell><TableCell><ToneBadge tone={record.status === "PRESENT" ? "green" : record.status === "ABSENT" ? "red" : "blue"}>{record.status}</ToneBadge></TableCell><TableCell>{record.workedMinutes} min</TableCell><TableCell>{record.lateMinutes} min</TableCell><TableCell>{record.approvedOvertimeMinutes} min</TableCell></tr>) : <tr><TableCell colSpan={6} className="py-10 text-center">No attendance records.</TableCell></tr>}</tbody></Table></DataTableCard>
  </AdminPage>;
}
