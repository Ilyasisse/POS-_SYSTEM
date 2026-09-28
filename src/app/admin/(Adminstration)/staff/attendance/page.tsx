import Link from "next/link";
import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  MetricCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  ATTENDANCE_BACKLOG_PAGE_SIZE,
  attendanceBacklogPage,
} from "@/lib/staff/attendance-backlog-page";
import {
  approveAttendanceAction,
  saveAttendancePolicyAction,
} from "../actions";

const label = "grid gap-1 text-sm font-semibold text-slate-700";

export default async function AttendanceAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ pendingPage?: string }>;
}) {
  await requirePermission(PERMISSIONS.ATTENDANCE_APPROVE);
  const params = await searchParams;
  const pendingWhere = {
    status: "SCHEDULED" as const,
    startsAt: { lte: new Date() },
    attendance: { is: null },
  };
  const [policy, pendingCount, statusCounts, records] = await Promise.all([
    prisma.attendancePolicy.findUnique({ where: { id: "default" } }),
    prisma.scheduledShift.count({ where: pendingWhere }),
    prisma.attendanceRecord.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.attendanceRecord.findMany({
      include: { worker: { select: { fullName: true } } },
      orderBy: { businessDate: "desc" },
      take: 50,
    }),
  ]);
  const pagination = attendanceBacklogPage(params?.pendingPage, pendingCount);
  const pending = await prisma.scheduledShift.findMany({
    where: pendingWhere,
    include: { worker: { select: { fullName: true } } },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    skip: pagination.skip,
    take: ATTENDANCE_BACKLOG_PAGE_SIZE,
  });
  const countStatus = (status: "PRESENT" | "ABSENT") =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0;
  return (
    <AdminPage
      title="Attendance approval"
      description="Review clock evidence, lateness, absence and approved overtime."
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Awaiting review" value={pendingCount} />
        <MetricCard label="Approved present" value={countStatus("PRESENT")} />
        <MetricCard label="Recorded absences" value={countStatus("ABSENT")} />
      </section>
      <Card className="p-5">
        <h2 className="mb-4 font-bold">Attendance policy</h2>
        <form
          action={saveAttendancePolicyAction}
          className="grid gap-4 md:grid-cols-4"
        >
          <label className={label}>
            Shift minutes
            <Input
              name="shiftMinutes"
              type="number"
              min="60"
              max="1440"
              defaultValue={policy?.shiftMinutes ?? 480}
            />
          </label>
          <label className={label}>
            Grace minutes
            <Input
              name="graceMinutes"
              type="number"
              min="0"
              max="120"
              defaultValue={policy?.graceMinutes ?? 10}
            />
          </label>
          <label className={label}>
            Overtime threshold
            <Input
              name="overtimeThresholdMinutes"
              type="number"
              min="0"
              max="480"
              defaultValue={policy?.overtimeThresholdMinutes ?? 30}
            />
          </label>
          <Button className="self-end" type="submit">
            Save policy
          </Button>
        </form>
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 font-bold">Shifts awaiting approval</h2>
        <div className="space-y-4">
          {pending.length ? (
            pending.map((shift) => (
              <form
                action={approveAttendanceAction}
                key={shift.id}
                className="grid gap-3 rounded-xl border p-4 md:grid-cols-5"
              >
                <input type="hidden" name="shiftId" value={shift.id} />
                <div>
                  <strong>{shift.worker.fullName}</strong>
                  <div className="text-xs text-slate-500">
                    {shift.startsAt.toLocaleString()}
                  </div>
                </div>
                <label className={label}>
                  Status
                  <select name="status" className="h-9 rounded-lg border px-3">
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="REJECTED">Rejected evidence</option>
                  </select>
                </label>
                <label className={label}>
                  Approved overtime
                  <Input
                    name="approvedOvertimeMinutes"
                    type="number"
                    min="0"
                    max="1440"
                    defaultValue="0"
                  />
                </label>
                <label className={label}>
                  Absence/correction note
                  <Input name="absenceReason" maxLength={500} />
                </label>
                <Button className="self-end" type="submit">
                  Approve
                </Button>
              </form>
            ))
          ) : (
            <p className="text-sm text-slate-500">No shifts await approval.</p>
          )}
        </div>
        {pagination.pageCount > 1 ? (
          <nav
            aria-label="Pending attendance pages"
            className="mt-4 flex items-center gap-4 text-sm font-semibold text-blue-700"
          >
            {pagination.page > 1 ? (
              <Link
                href={`/admin/staff/attendance?pendingPage=${pagination.page - 1}`}
              >
                Previous
              </Link>
            ) : null}
            <span className="text-slate-600">
              Page {pagination.page} of {pagination.pageCount}
            </span>
            {pagination.page < pagination.pageCount ? (
              <Link
                href={`/admin/staff/attendance?pendingPage=${pagination.page + 1}`}
              >
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Card>
      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Business date</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Worked</TableHead>
              <TableHead>Late</TableHead>
              <TableHead>Overtime</TableHead>
            </tr>
          </thead>
          <tbody>
            {records.length ? (
              records.map((record) => (
                <tr key={record.id}>
                  <TableCell>
                    {record.businessDate.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {record.worker.fullName}
                  </TableCell>
                  <TableCell>
                    <ToneBadge
                      tone={
                        record.status === "PRESENT"
                          ? "green"
                          : record.status === "ABSENT"
                            ? "red"
                            : "blue"
                      }
                    >
                      {record.status}
                    </ToneBadge>
                  </TableCell>
                  <TableCell>{record.workedMinutes} min</TableCell>
                  <TableCell>{record.lateMinutes} min</TableCell>
                  <TableCell>{record.approvedOvertimeMinutes} min</TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={6} className="py-10 text-center">
                  No attendance records.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
