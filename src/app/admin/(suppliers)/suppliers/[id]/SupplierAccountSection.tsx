import SupplierPaymentComposer from "./SupplierPaymentComposer";
import Link from "next/link";
import type { UserRole } from "@prisma/client";
import {
  Card,
  DataTableCard,
  MetricCard,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { isDailyCashLocked } from "@/lib/daily-cash/business-date";
import { formatSupplierInvoiceNumber } from "@/lib/suppliers/invoice-number";
import { getSupplierPaymentReversalError } from "@/lib/suppliers/payment-reversal";
import { formatBusinessDateKey } from "@/lib/waiter/waiter-balance-calculations";
import RevertPaymentButton from "../../supplier-bills/RevertPaymentButton";

type MoneyValue = { toString(): string };

type SupplierAccountSectionProps = {
  supplierId: string;
  outstanding: number;
  credit: number;
  totalCashPaid: number;
  currentUser: { role: UserRole };
  payments: Array<{
    id: string;
    amount: MoneyValue;
    paymentMethod: string | null;
    notes: string | null;
    paidAt: Date;
    recordedBy: { fullName: string };
    dailyCashPayment: {
      dailyCashDay: { businessDate: Date };
    } | null;
    allocations: Array<{
      id: string;
      amount: MoneyValue;
      installmentId: string | null;
      bill: {
        invoice: { id: string; invoiceNumber: number };
        _count: { installments: number };
      };
    }>;
  }>;
};

export default function SupplierAccountSection({
  supplierId,
  outstanding,
  credit,
  totalCashPaid,
  currentUser,
  payments,
}: SupplierAccountSectionProps) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Outstanding invoices" value={formatMoney(outstanding)} />
        <MetricCard label="Available credit" value={formatMoney(credit)} />
        <MetricCard label="Total cash paid" value={formatMoney(totalCashPaid)} />
      </section>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Supplier account</h2>
          <p className="text-muted-foreground text-sm">
            Payments clear open invoices oldest-first. Any remainder stays as credit and is applied
            automatically when a future invoice is finalized.
          </p>
        </div>
        <SupplierPaymentComposer supplierId={supplierId} />
      </Card>

      <DataTableCard>
        <Table data-supplier-cards>
          <thead>
            <tr>
              <TableHead>Paid</TableHead>
              <TableHead>Cash amount</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Unused credit</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {payments.length ? (
              payments.map((payment) => {
                const allocated = payment.allocations.reduce(
                  (sum, allocation) => sum + Number(allocation.amount),
                  0,
                );
                const unused = Number(payment.amount) - allocated;
                const dailyCashDate = payment.dailyCashPayment
                  ? formatBusinessDateKey(payment.dailyCashPayment.dailyCashDay.businessDate)
                  : null;
                const reversalError = getSupplierPaymentReversalError({
                  legacyAllocationAfterSchedule: payment.allocations.some(
                    (allocation) =>
                      !allocation.installmentId && allocation.bill._count.installments > 0,
                  ),
                  dailyCashLinked: Boolean(payment.dailyCashPayment),
                  dailyCashLocked: dailyCashDate ? isDailyCashLocked(dailyCashDate) : false,
                  canManageDailyCash: hasPermission(currentUser, PERMISSIONS.DAILY_CASH_MANAGE),
                });
                return (
                  <tr key={payment.id} className="border-t align-top">
                    <TableCell data-label="Paid">
                      <div>{payment.paidAt.toLocaleDateString()}</div>
                      <div className="text-muted-foreground text-xs">
                        {payment.recordedBy.fullName}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums" data-label="Cash amount">
                      {formatMoney(Number(payment.amount))}
                    </TableCell>
                    <TableCell className="tabular-nums" data-label="Applied">
                      {formatMoney(allocated)}
                    </TableCell>
                    <TableCell
                      className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-300"
                      data-label="Unused credit"
                    >
                      {formatMoney(unused)}
                    </TableCell>
                    <TableCell className="text-xs" data-label="Details">
                      <div>
                        {payment.paymentMethod || "Unspecified method"}
                        {dailyCashDate ? ` · Daily Cash ${dailyCashDate}` : ""}
                      </div>
                      <div>{payment.notes || "No note"}</div>
                      {payment.allocations.map((allocation) => (
                        <div key={allocation.id} className="text-muted-foreground">
                          {formatMoney(Number(allocation.amount))} →{" "}
                          <Link
                            prefetch={false}
                            className="underline"
                            href={`/admin/supplier-invoices/${allocation.bill.invoice.id}`}
                          >
                            {formatSupplierInvoiceNumber(allocation.bill.invoice.invoiceNumber)}
                          </Link>
                        </div>
                      ))}
                    </TableCell>
                    <TableCell data-label="Action">
                      <RevertPaymentButton
                        paymentId={payment.id}
                        amount={formatMoney(Number(payment.amount))}
                        disabledReason={reversalError}
                      />
                    </TableCell>
                  </tr>
                );
              })
            ) : (
              <tr>
                <TableCell colSpan={6}>No supplier payments have been recorded.</TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </>
  );
}
