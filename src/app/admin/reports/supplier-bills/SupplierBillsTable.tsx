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
  receiptUrl: string;
  delivery: {
    id: string;
    submittedAt: Date;
    invoiceNumber: string | null;
    totalAmount: MoneyValue | null;
    status: string;
    supplier: { name: string };
    verifiedBy: { fullName: string } | null;
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
    } | null;
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
            <TableHead>Supplier / delivery</TableHead>
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
            rows.map(({ delivery, receiptUrl }) => {
              const bill = delivery.bill;
              const remaining = bill
                ? Number(bill.totalAmount.toString()) -
                  Number(bill.paidAmount.toString())
                : 0;
              const dueState = bill
                ? getSupplierBillDueState(bill.dueDate, now)
                : null;

              return (
                <tr
                  key={delivery.id}
                  className="border-t border-slate-100 align-top"
                >
                  <TableCell>
                    <Link
                      href={`/admin/supplier-deliveries/${delivery.id}`}
                      className="font-bold text-blue-600"
                    >
                      {delivery.supplier.name}
                    </Link>
                    <div className="text-xs">
                      {delivery.submittedAt.toLocaleDateString()} ·{" "}
                      {delivery.invoiceNumber || "No invoice #"}
                    </div>
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-slate-500 underline"
                    >
                      Receipt image
                    </a>
                  </TableCell>
                  <TableCell>
                    {bill ? (
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
                    ) : (
                      "Verify first"
                    )}
                  </TableCell>
                  <TableCell>
                    {money(Number(delivery.totalAmount?.toString() || 0))}
                    <div className="text-xs">Balance {money(remaining)}</div>
                  </TableCell>
                  <TableCell>
                    <ToneBadge
                      tone={
                        delivery.status === "VERIFIED"
                          ? "green"
                          : delivery.status === "REJECTED"
                            ? "red"
                            : "amber"
                      }
                    >
                      {delivery.status.replaceAll("_", " ")}
                    </ToneBadge>
                    <div className="mt-1">
                      {bill ? (
                        <ToneBadge
                          tone={bill.status === "PAID" ? "green" : "amber"}
                        >
                          {bill.status}
                        </ToneBadge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>Verified: {delivery.verifiedBy?.fullName || "--"}</div>
                    <div>Paid: {bill?.settledBy?.fullName || "--"}</div>
                    <div className="text-xs">
                      {bill?.settledAt?.toLocaleString() || ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    {bill?.payments.length
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
                    {bill && remaining > 0 ? (
                      <PaymentForm billId={bill.id} remaining={remaining} />
                    ) : bill ? (
                      "Paid in full"
                    ) : (
                      "Verify first"
                    )}
                  </TableCell>
                </tr>
              );
            })
          ) : (
            <tr>
              <TableCell colSpan={7}>
                No supplier activity in this date range.
              </TableCell>
            </tr>
          )}
        </tbody>
      </Table>
    </DataTableCard>
  );
}
