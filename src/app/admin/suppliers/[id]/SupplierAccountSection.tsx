import Link from "next/link";
import type { UserRole } from "@prisma/client";
import {
  Button,
  Card,
  DataTableCard,
  MetricCard,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { isDailyCashLocked } from "@/lib/daily-cash/business-date";
import { getSupplierPaymentReversalError } from "@/lib/suppliers/payment-reversal";
import { formatBusinessDateKey } from "@/lib/waiter/waiter-balance-calculations";
import RevertPaymentButton from "@/app/admin/reports/supplier-bills/RevertPaymentButton";
import { recordSupplierAdvance } from "./actions";

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
        invoice: { id: string; invoiceNumber: string | null };
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
        <MetricCard
          label="Outstanding invoices"
          value={formatMoney(outstanding)}
        />
        <MetricCard label="Available credit" value={formatMoney(credit)} />
        <MetricCard
          label="Total cash paid"
          value={formatMoney(totalCashPaid)}
        />
      </section>

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Supplier account</h2>
          <p className="text-sm text-muted-foreground">
            Payments clear open invoices oldest-first. Any remainder stays as
            credit and is applied automatically when a future invoice is
            finalized.
          </p>
        </div>
        <form
          action={recordSupplierAdvance}
          className="grid gap-3 md:grid-cols-[9rem_10rem_1fr_auto] md:items-end"
        >
          <Input type="hidden" name="supplierId" value={supplierId} />
          <div className="grid gap-1.5">
            <Label htmlFor="supplier-payment-amount">Amount</Label>
            <Input
              id="supplier-payment-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="supplier-payment-method">Method</Label>
            <select
              id="supplier-payment-method"
              name="paymentMethod"
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Unspecified</option>
              <option>MYCASH</option>
              <option>GOLIS</option>
              <option>Dahabshiil</option>
              <option>Cash</option>
              <option>Bank</option>
              <option>Other</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="supplier-payment-note">Note</Label>
            <Input
              id="supplier-payment-note"
              name="notes"
              maxLength={500}
              placeholder="Advance or payment reference"
            />
          </div>
          <Button type="submit">Record payment</Button>
        </form>
      </Card>

      <DataTableCard>
        <Table>
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
                  ? formatBusinessDateKey(
                      payment.dailyCashPayment.dailyCashDay.businessDate,
                    )
                  : null;
                const reversalError = getSupplierPaymentReversalError({
                  legacyAllocationAfterSchedule: payment.allocations.some(
                    (allocation) =>
                      !allocation.installmentId &&
                      allocation.bill._count.installments > 0,
                  ),
                  dailyCashLinked: Boolean(payment.dailyCashPayment),
                  dailyCashLocked: dailyCashDate
                    ? isDailyCashLocked(dailyCashDate)
                    : false,
                  canManageDailyCash: hasPermission(
                    currentUser,
                    PERMISSIONS.DAILY_CASH_MANAGE,
                  ),
                });
                return (
                  <tr key={payment.id} className="border-t align-top">
                    <TableCell>
                      <div>{payment.paidAt.toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">
                        {payment.recordedBy.fullName}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatMoney(Number(payment.amount))}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(allocated)}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums text-emerald-700">
                      {formatMoney(unused)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>
                        {payment.paymentMethod || "Unspecified method"}
                        {dailyCashDate ? ` · Daily Cash ${dailyCashDate}` : ""}
                      </div>
                      <div>{payment.notes || "No note"}</div>
                      {payment.allocations.map((allocation) => (
                        <div
                          key={allocation.id}
                          className="text-muted-foreground"
                        >
                          {formatMoney(Number(allocation.amount))} →{" "}
                          <Link
                            className="underline"
                            href={`/admin/supplier-invoices/${allocation.bill.invoice.id}`}
                          >
                            {allocation.bill.invoice.invoiceNumber || "Invoice"}
                          </Link>
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
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
                <TableCell colSpan={6}>
                  No supplier payments have been recorded.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </>
  );
}
