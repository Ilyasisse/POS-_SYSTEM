import Link from "next/link";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  currentCafeMonth,
  formatWorkMinutes,
  parseLaborMonth,
} from "@/lib/reports/labor-month";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default async function LaborSummaryPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  await requirePermission(PERMISSIONS.REPORT_STAFF_VIEW);
  const current = currentCafeMonth();
  const { month, start, end } = parseLaborMonth(
    (await searchParams)?.month ?? current,
    current,
  );
  const rows = await prisma.attendanceRecord.groupBy({
    by: ["workerId"],
    where: {
      businessDate: { gte: start, lt: end },
      status: "PRESENT",
      approvedAt: { not: null },
    },
    _sum: {
      workedMinutes: true,
      approvedOvertimeMinutes: true,
      lateMinutes: true,
    },
    _count: { id: true },
    orderBy: { _sum: { workedMinutes: "desc" } },
  });
  const workers = rows.length
    ? await prisma.staff.findMany({
        where: { id: { in: rows.map((row) => row.workerId) } },
        select: { id: true, fullName: true },
      })
    : [];
  const names = new Map(workers.map((worker) => [worker.id, worker.fullName]));
  const totalMinutes = rows.reduce(
    (sum, row) => sum + (row._sum.workedMinutes ?? 0),
    0,
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <Link href="/admin/business-intelligence" className="text-sm underline">
          ← Business intelligence
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Monthly labor hours</h1>
        <p className="text-sm text-muted-foreground">
          Approved attendance for {month}, using the café calendar.
        </p>
      </header>
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4"
      >
        <label className="grid gap-2 text-sm font-semibold">
          Month
          <Input
            name="month"
            type="month"
            min="2020-01"
            max={current}
            defaultValue={month}
            required
          />
        </label>
        <Button type="submit">Show hours</Button>
      </form>
      <section className="rounded-xl border bg-background p-5">
        <h2 className="text-lg font-semibold">
          Approved time: {formatWorkMinutes(totalMinutes)}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Only approved present attendance counts. Pending, absent, and
          unapproved records are excluded. Hours and overtime are shown
          separately; this report does not calculate wages.
        </p>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm">
            No approved attendance recorded for this month.
          </p>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-2">
                  Employee
                </th>
                <th scope="col" className="p-2">
                  Days
                </th>
                <th scope="col" className="p-2">
                  Worked
                </th>
                <th scope="col" className="p-2">
                  Approved overtime
                </th>
                <th scope="col" className="p-2">
                  Late
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.workerId} className="border-b">
                  <td className="p-2 font-semibold">
                    {names.get(row.workerId) ?? "Former employee"}
                  </td>
                  <td className="p-2">{row._count.id}</td>
                  <td className="p-2">
                    {formatWorkMinutes(row._sum.workedMinutes ?? 0)}
                  </td>
                  <td className="p-2">
                    {formatWorkMinutes(row._sum.approvedOvertimeMinutes ?? 0)}
                  </td>
                  <td className="p-2">
                    {formatWorkMinutes(row._sum.lateMinutes ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
