import Link from "next/link";
import {
  DataTableCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { getSupplierBillDueState } from "@/lib/suppliers/supplier-bills";
import DueDateForm from "./DueDateForm";
import PaymentForm from "./PaymentForm";

type MoneyValue = { toString(): string };

export type SupplierBillReportRow = {
  source: {
    kind: "delivery" | "invoice";
    id: string;
    occurredAt: Date;
    invoiceNumber: string | null;
    status: string;
    supplierName: string;
    auditLabel: string;
    auditName: string | null;
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
            <TableHead>Supplier / source</TableHead>
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
            rows.map(({ source, bill }) => {
              const remaining =
                Number(bill.totalAmount.toString()) -
                Number(bill.paidAmount.toString());
              const dueState = getSupplierBillDueState(bill.dueDate, now);
              const sourceHref =
                source.kind === "invoice"
                  ? `/admin/supplier-invoices/${source.id}`
                  : `/admin/supplier-deliveries/${source.id}`;

              return (
                <tr
                  key={bill.id}
                  className="border-t border-slate-100 align-top"
                >
                  <TableCell>
                    <Link href={sourceHref} className="font-bold text-blue-600">
                      {source.supplierName}
                    </Link>
                    <div className="text-xs">
                      {source.kind === "invoice"
                        ? "Invoice"
                        : "Legacy delivery"}{" "}
                      · {source.occurredAt.toLocaleDateString()} ·{" "}
                      {source.invoiceNumber || "No invoice #"}
                    </div>
                    {source.receiptUrl ? (
                      <a
                        href={source.receiptUrl}
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
                    <ToneBadge tone="green">
                      {source.status.replaceAll("_", " ")}
                    </ToneBadge>
                    <div className="mt-1">
                      <ToneBadge
                        tone={bill.status === "PAID" ? "green" : "amber"}
                      >
                        {bill.status}
                      </ToneBadge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {source.auditLabel}: {source.auditName || "--"}
                    </div>
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
