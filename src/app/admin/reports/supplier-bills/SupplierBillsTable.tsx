import Link from "next/link";
import {
  DataTableCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { getSupplierBillDueState } from "@/lib/suppliers/supplier-bills";
import {
  getSupplierInvoiceDisplayStatus,
  SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS,
  SUPPLIER_INVOICE_DISPLAY_STATUS_TONES,
} from "@/lib/suppliers/invoice-status";
import DueDateForm from "./DueDateForm";
import PaymentForm from "./PaymentForm";

type MoneyValue = { toString(): string };

export type SupplierBillReportRow = {
  invoice: {
    id: string;
    submittedAt: Date;
    invoiceNumber: string | null;
    status: "DRAFT" | "FINALIZED" | "VOID";
    supplierName: string;
    finalizedByName: string | null;
    receiptUrl: string | null;
  };
  bill: {
    id: string;
    totalAmount: MoneyValue;
    paidAmount: MoneyValue;
    status: "UNPAID" | "PARTIAL" | "PAID";
    dueDate: Date;
    settledBy: { fullName: string } | null;
    settledAt: Date | null;
    payments: Array<{
      id: string;
      amount: MoneyValue;
      paymentMethod: string | null;
      paidAt: Date;
      recordedBy: { fullName: string };
    }>;
  };
};

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function SupplierBillsTable({
  rows,
  now,
}: {
  rows: SupplierBillReportRow[];
  now: Date;
}) {
  return (
    <DataTableCard>
      <Table>
        <thead>
          <tr>
            <TableHead>Supplier / invoice</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead>Total / balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Audit</TableHead>
            <TableHead>Payments</TableHead>
            <TableHead>Record payment</TableHead>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(({ invoice, bill }) => {
              const remaining =
                Number(bill.totalAmount.toString()) -
                Number(bill.paidAmount.toString());
              const dueState = getSupplierBillDueState(bill.dueDate, now);
              const displayStatus = getSupplierInvoiceDisplayStatus(
                {
                  status: invoice.status,
                  bill: { status: bill.status, dueDate: bill.dueDate },
                },
                now,
              );

              return (
                <tr
                  key={bill.id}
                  className="border-t border-slate-100 align-top"
                >
                  <TableCell>
                    <Link
                      href={`/admin/supplier-invoices/${invoice.id}`}
                      className="font-bold text-blue-600"
                    >
                      {invoice.supplierName}
                    </Link>
                    <div className="text-xs">
                      {invoice.submittedAt.toLocaleDateString()} ·{" "}
                      {invoice.invoiceNumber || "No invoice #"}
                    </div>
                    {invoice.receiptUrl ? (
                      <a
                        href={invoice.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-slate-500 underline"
                      >
                        Receipt image
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <ToneBadge
                        tone={
                          bill.status === "PAID"
                            ? "green"
                            : dueState === "overdue"
                              ? "red"
                              : dueState === "today"
                                ? "amber"
                                : dueState === "tomorrow"
                                  ? "blue"
                                  : "slate"
                        }
                      >
                        {bill.status === "PAID"
                          ? "PAID"
                          : dueState === "overdue"
                            ? "OVERDUE"
                            : dueState === "today"
                              ? "DUE TODAY"
                              : dueState === "tomorrow"
                                ? "DUE TOMORROW"
                                : "UPCOMING"}
                      </ToneBadge>
                      {bill.status === "PAID" ? (
                        <p className="text-xs font-bold text-slate-600">
                          {bill.dueDate.toLocaleDateString("en-US", {
                            timeZone: "UTC",
                          })}
                        </p>
                      ) : (
                        <DueDateForm
                          billId={bill.id}
                          dueDate={bill.dueDate.toISOString().slice(0, 10)}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {money(Number(bill.totalAmount.toString()))}
                    <div className="text-xs">Balance {money(remaining)}</div>
                  </TableCell>
                  <TableCell>
                    <ToneBadge
                      tone={SUPPLIER_INVOICE_DISPLAY_STATUS_TONES[displayStatus]}
                    >
                      {SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS[displayStatus]}
                    </ToneBadge>
                  </TableCell>
                  <TableCell>
                    <div>Finalized: {invoice.finalizedByName || "--"}</div>
                    <div>Paid: {bill.settledBy?.fullName || "--"}</div>
                    <div className="text-xs">
                      {bill.settledAt?.toLocaleString() || ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    {bill.payments.length
                      ? bill.payments.map((payment) => (
                          <div key={payment.id} className="mb-2 text-xs">
                            <strong>
                              {money(Number(payment.amount.toString()))}
                            </strong>{" "}
                            · {payment.paymentMethod || "Unspecified"}
                            <br />
                            {payment.recordedBy.fullName} ·{" "}
                            {payment.paidAt.toLocaleDateString()}
                          </div>
                        ))
                      : "--"}
                  </TableCell>
                  <TableCell>
                    {remaining > 0 ? (
                      <PaymentForm billId={bill.id} remaining={remaining} />
                    ) : (
                      "Paid in full"
                    )}
                  </TableCell>
                </tr>
              );
            })
          ) : (
            <tr>
              <TableCell colSpan={7}>
                No supplier bills match these filters.
              </TableCell>
            </tr>
          )}
        </tbody>
      </Table>
    </DataTableCard>
  );
}
