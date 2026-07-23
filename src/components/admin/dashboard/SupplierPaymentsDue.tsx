import Link from "next/link";
import { ArrowRight, CalendarClock, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import type { SupplierDueSummary } from "@/lib/suppliers/supplier-bills";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDateKey(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

export default function SupplierPaymentsDue({
  summary,
}: {
  summary: SupplierDueSummary;
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-xl bg-amber-100 p-2 text-amber-700">
            <CalendarClock className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950 sm:text-lg">
              Supplier payments due by tomorrow
            </h2>
            <p className="text-sm text-slate-600">
              Unpaid and partially paid finalized-invoice bills, including all
              overdue balances.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/reports/supplier-bills?scope=due-through-tomorrow">
            View bills
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
        {[
          ["Suppliers", summary.supplierCount.toString()],
          ["Overdue", formatMoney(summary.overdueRemaining)],
          ["Due today", formatMoney(summary.dueTodayRemaining)],
          ["Due tomorrow", formatMoney(summary.dueTomorrowRemaining)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3 sm:px-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      {summary.suppliers.length ? (
        <div className="divide-y divide-slate-100">
          {summary.suppliers.map((supplier) => (
            <div
              key={supplier.supplierId}
              className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/reports/supplier-bills?scope=due-through-tomorrow&supplier=${supplier.supplierId}`}
                    className="font-black text-slate-950 hover:text-blue-700"
                  >
                    {supplier.supplierName}
                  </Link>
                  {supplier.overdueRemaining > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                      <CircleAlert className="size-3.5" />
                      {formatMoney(supplier.overdueRemaining)} overdue
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {supplier.billCount}{" "}
                  {supplier.billCount === 1 ? "bill" : "bills"} · oldest due{" "}
                  {formatDateKey(supplier.oldestDueDateKey)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-lg font-black text-slate-950">
                  {formatMoney(supplier.totalRemaining)}
                </p>
                <p className="text-xs text-slate-500">
                  remaining through tomorrow
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="font-bold text-emerald-700">
            Nothing is due by tomorrow.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Future bills remain available in the supplier-bills report.
          </p>
        </div>
      )}
    </Card>
  );
}
