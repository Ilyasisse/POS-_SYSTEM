import Link from "next/link";
import { AdminPage, Button, Card, ToneBadge } from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  boundedPayrollRunPage,
  PAYROLL_RUN_PAGE_SIZE,
  payrollRunBrowserParams,
  payrollRunStatuses,
} from "@/lib/staff/payroll-run-browser";
import { transitionPayrollRunAction } from "../../actions";

type Props = {
  searchParams?: Promise<{ status?: string; page?: string }>;
};

const usd = (value: { toFixed(digits: number): string }) =>
  `$${value.toFixed(2)}`;

export default async function PayrollRunsPage({ searchParams }: Props) {
  await requirePermission(PERMISSIONS.PAYROLL_MANAGE);
  const params = await searchParams;
  const requested = payrollRunBrowserParams(params?.status, params?.page);
  const where = requested.status === "ALL" ? {} : { status: requested.status };
  const total = await prisma.payrollRun.count({ where });
  const { page, pages } = boundedPayrollRunPage(requested.page, total);
  const runs = await prisma.payrollRun.findMany({
    where,
    include: {
      lines: {
        include: { worker: { select: { fullName: true } } },
        orderBy: { worker: { fullName: "asc" } },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAYROLL_RUN_PAGE_SIZE,
    take: PAYROLL_RUN_PAGE_SIZE,
  });
  const href = (target: number) =>
    `/admin/staff/payroll/runs?status=${requested.status}&page=${target}`;

  return (
    <AdminPage
      title="Payroll runs"
      description="Review every payroll draft, approval, finalized run, and voided run."
    >
      <Link
        prefetch={false}
        className="text-sm font-semibold text-blue-700 underline"
        href="/admin/staff/payroll"
      >
        Back to payroll
      </Link>
      <nav className="flex flex-wrap gap-2" aria-label="Payroll run status">
        {payrollRunStatuses.map((status) => (
          <Link
            key={status}
            prefetch={false}
            href={`/admin/staff/payroll/runs?status=${status}`}
            aria-current={requested.status === status ? "page" : undefined}
            className={`rounded-lg border px-3 py-2 text-sm ${requested.status === status ? "border-blue-600 bg-blue-50 font-semibold" : "border-slate-200"}`}
          >
            {status === "ALL" ? "All runs" : status}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-slate-600">
        {total} {total === 1 ? "run" : "runs"} · Page {page} of {pages}
      </p>
      {runs.length ? (
        runs.map((run) => (
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
                <p className="mt-1 text-xs text-slate-500">
                  Created {run.createdAt.toLocaleString()}
                </p>
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
                  <tr className="text-left text-slate-500">
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
        ))
      ) : (
        <Card className="p-5 text-sm text-slate-600">
          No payroll runs match this status.
        </Card>
      )}
      <nav
        className="flex items-center gap-4 text-sm"
        aria-label="Payroll run pages"
      >
        {page > 1 ? (
          <Link
            prefetch={false}
            className="font-semibold text-blue-700 underline"
            href={href(page - 1)}
          >
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link
            prefetch={false}
            className="font-semibold text-blue-700 underline"
            href={href(page + 1)}
          >
            Next
          </Link>
        ) : null}
      </nav>
    </AdminPage>
  );
}
