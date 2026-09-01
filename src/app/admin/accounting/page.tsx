import { AdminPage, Card } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatBusinessDate } from "@/lib/reports/reporting-calendar";

export default async function AccountingExportPage() {
  await requirePermission(PERMISSIONS.REPORT_FINANCIAL_VIEW);
  const today = formatBusinessDate(new Date());

  return (
    <AdminPage
      title="Accounting export"
      description="Download a balanced, accounting-ready journal for external bookkeeping software."
    >
      <Card className="max-w-3xl p-6">
        <h2 className="text-lg font-black">Journal CSV</h2>
        <p className="mt-2 text-sm text-slate-600">
          Includes sale payments, approved expenses, supplier payments, supplier advances, and owner withdrawals. Every entry balances debits and credits.
        </p>
        <form action="/api/admin/accounting/export" method="get" className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-semibold">
            From
            <Input type="date" name="from" defaultValue={today} required />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            To
            <Input type="date" name="to" defaultValue={today} required />
          </label>
          <button type="submit" className="h-10 rounded-md bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700">
            Download CSV
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Review account names before importing. Payroll is excluded until an actual payroll payment is recorded, preventing unpaid payroll from being treated as cash activity.
        </p>
      </Card>
    </AdminPage>
  );
}
