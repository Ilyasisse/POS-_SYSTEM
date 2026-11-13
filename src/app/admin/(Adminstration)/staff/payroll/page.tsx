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
import { normalizeFilterChoice } from "@/lib/admin/admin-filters";
import {
  PAYROLL_ADJUSTMENT_PAGE_SIZE,
  payrollAdjustmentPage,
} from "@/lib/staff/payroll-adjustment-page";
import {
  approvePayrollAdjustmentAction,
  createPayrollAdjustmentAction,
  createPayrollRunAction,
  transitionPayrollRunAction,
} from "../actions";

const label = "grid gap-1 text-sm font-semibold text-foreground";
const usd = (value: { toFixed(digits: number): string }) =>
  `$${value.toFixed(2)}`;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; page?: string }>;
}) {
  await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  const params = await searchParams;
  const view = normalizeFilterChoice(
    params?.view,
    ["all", "pending", "approved"] as const,
    "all",
  );
  const adjustmentWhere =
    view === "pending"
      ? { approvedAt: null }
      : view === "approved"
        ? { approvedAt: { not: null } }
        : {};
  const [staff, adjustmentCount, pendingCount, finalizedPay, runs] =
    await Promise.all([
      prisma.staff.findMany({
        where: { employmentProfile: { is: { status: "ACTIVE" } } },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true },
      }),
      prisma.payrollAdjustment.count({ where: adjustmentWhere }),
      prisma.payrollAdjustment.count({ where: { approvedAt: null } }),
      prisma.payrollLine.aggregate({
        where: { payrollRun: { status: "FINALIZED" } },
        _sum: { netPay: true },
      }),
      prisma.payrollRun.findMany({
        include: {
          lines: { include: { worker: { select: { fullName: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
    ]);
  const pagination = payrollAdjustmentPage(params?.page, adjustmentCount);
  const adjustments = await prisma.payrollAdjustment.findMany({
    where: adjustmentWhere,
    include: { worker: { select: { fullName: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: pagination.skip,
    take: PAYROLL_ADJUSTMENT_PAGE_SIZE,
  });
  const paid = Number(finalizedPay._sum.netPay ?? 0);

  function pageHref(page: number) {
    const query = new URLSearchParams();
    if (view !== "all") query.set("view", view);
    query.set("page", String(page));
    return `/admin/staff/payroll?${query.toString()}`;
  }
  return (
    <AdminPage
      title="Payroll"
      description="Admin-only payroll adjustments, previews, approval, finalization and voiding."
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active profiles" value={staff.length} />
        <MetricCard label="Pending adjustments" value={pendingCount} />
        <MetricCard label="Finalized total" value={`$${paid.toFixed(2)}`} />
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-bold">Add payroll adjustment</h2>
          <form
            action={createPayrollAdjustmentAction}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className={label}>
              Worker
              <select name="workerId" className="h-9 rounded-lg border px-3">
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Type
              <select name="type" className="h-9 rounded-lg border px-3">
                <option value="BONUS">Bonus</option>
                <option value="OVERTIME">Overtime pay</option>
                <option value="ADVANCE">Advance</option>
                <option value="ABSENCE_DEDUCTION">Absence deduction</option>
                <option value="CORRECTION">Correction</option>
              </select>
            </label>
            <label className={label}>
              Period start
              <Input name="periodStart" type="date" required />
            </label>
            <label className={label}>
              Period end
              <Input name="periodEnd" type="date" required />
            </label>
            <label className={label}>
              Amount (USD)
              <Input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label className={label}>
              Reason
              <Input name="reason" minLength={3} maxLength={500} required />
            </label>
            <Button type="submit">Record adjustment</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-bold">Create payroll preview</h2>
          <form
            action={createPayrollRunAction}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className={label}>
              Period start
              <Input name="periodStart" type="date" required />
            </label>
            <label className={label}>
              Period end
              <Input name="periodEnd" type="date" required />
            </label>
            <Button type="submit">Create draft run</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Only approved attendance and approved adjustments are snapshotted.
            Finalized periods cannot overlap.
          </p>
        </Card>
      </section>
      <DataTableCard
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>
              Showing {adjustmentCount === 0 ? 0 : pagination.skip + 1} to{" "}
              {Math.min(pagination.skip + adjustments.length, adjustmentCount)}{" "}
              of {adjustmentCount} adjustments
            </span>
            {pagination.pageCount > 1 ? (
              <nav
                aria-label="Payroll adjustment pages"
                className="flex items-center gap-3"
              >
                {pagination.page > 1 ? (
                  <Link href={pageHref(pagination.page - 1)}>Previous</Link>
                ) : null}
                <span>
                  Page {pagination.page} of {pagination.pageCount}
                </span>
                {pagination.page < pagination.pageCount ? (
                  <Link href={pageHref(pagination.page + 1)}>Next</Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        }
      >
        <form
          method="get"
          className="flex flex-wrap items-center gap-2 p-4 text-sm"
        >
          <label htmlFor="adjustment-view" className="font-semibold">
            Adjustments
          </label>
          <select
            id="adjustment-view"
            name="view"
            defaultValue={view}
            className="rounded-lg border px-3 py-2"
          >
            <option value="all">All</option>
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
          </select>
          <Button type="submit" size="sm">
            Filter
          </Button>
        </form>
        <Table>
          <thead>
            <tr>
              <TableHead>Worker</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {adjustments.length ? (
              adjustments.map((row) => (
                <tr key={row.id}>
                  <TableCell className="font-semibold">
                    {row.worker.fullName}
                  </TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>
                    {row.periodStart.toLocaleDateString()} –{" "}
                    {row.periodEnd.toLocaleDateString()}
                  </TableCell>
                  <TableCell>{usd(row.amount)}</TableCell>
                  <TableCell>
                    <ToneBadge tone={row.approvedAt ? "green" : "amber"}>
                      {row.approvedAt ? "APPROVED" : "PENDING"}
                    </ToneBadge>
                  </TableCell>
                  <TableCell>
                    {!row.approvedAt ? (
                      <form action={approvePayrollAdjustmentAction}>
                        <input
                          type="hidden"
                          name="adjustmentId"
                          value={row.id}
                        />
                        <Button size="sm" variant="outline">
                          Approve
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
                  No payroll adjustments.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
      <div className="space-y-4">
        {runs.map((run) => (
          <Card className="p-5" key={run.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-bold">
                  {run.periodStart.toLocaleDateString()} –{" "}
                  {run.periodEnd.toLocaleDateString()}
                </h2>
                <ToneBadge
                  tone={
                    run.status === "FINALIZED"
                      ? "green"
                      : run.status === "VOIDED"
                        ? "red"
                        : "blue"
                  }
                >
                  {run.status}
                </ToneBadge>
              </div>
              <div className="flex gap-2">
                {run.status === "DRAFT" ? (
                  <form action={transitionPayrollRunAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="action" value="APPROVE" />
                    <Button size="sm">Approve</Button>
                  </form>
                ) : null}
                {run.status === "APPROVED" ? (
                  <form action={transitionPayrollRunAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="action" value="FINALIZE" />
                    <Button size="sm">Finalize</Button>
                  </form>
                ) : null}
                {run.status !== "VOIDED" ? (
                  <form action={transitionPayrollRunAction}>
                    <input type="hidden" name="runId" value={run.id} />
                    <input type="hidden" name="action" value="VOID" />
                    <input
                      type="hidden"
                      name="reason"
                      value="Voided from payroll administration"
                    />
                    <Button size="sm" variant="outline">
                      Void
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th>Worker</th>
                    <th>Base</th>
                    <th>Overtime</th>
                    <th>Additions</th>
                    <th>Deductions</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {run.lines.map((line) => (
                    <tr className="border-t" key={line.id}>
                      <td className="py-2 font-semibold">
                        {line.worker.fullName}
                      </td>
                      <td>{usd(line.basePay)}</td>
                      <td>{usd(line.overtimePay)}</td>
                      <td>{usd(line.additions)}</td>
                      <td>{usd(line.deductions)}</td>
                      <td className="font-bold">{usd(line.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
