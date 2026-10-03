import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  normalizeFilterChoice,
  isValidDateKey,
} from "@/lib/admin/admin-filters";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  RECEIPT_ARCHIVE_PAGE_SIZE,
  receiptArchiveDateRange,
  receiptArchivePage,
} from "@/lib/payments/receipt-archive";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{
    date?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

export default async function PaymentReceiptArchive({ searchParams }: Props) {
  await requirePermission(PERMISSIONS.PAYMENT_RECEIPT_MANAGE);
  const params = await searchParams;
  const date = isValidDateKey(params?.date) ? params.date : "";
  const range = receiptArchiveDateRange(date);
  const q = params?.q?.trim().slice(0, 100) ?? "";
  const status = normalizeFilterChoice(
    params?.status,
    ["all", "AVAILABLE", "ASSIGNED", "OUTGOING", "NEEDS_REVIEW"] as const,
    "all",
  );
  const where: Prisma.MobileMoneyReceiptWhereInput = {
    ...(status !== "all" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { providerReference: { contains: q, mode: "insensitive" } },
            { counterpartyLabel: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(range
      ? {
          AND: [
            {
              OR: [
                { transactionAt: { gte: range.start, lt: range.end } },
                {
                  transactionAt: null,
                  receivedAt: { gte: range.start, lt: range.end },
                },
              ],
            },
          ],
        }
      : {}),
  };
  const total = await prisma.mobileMoneyReceipt.count({ where });
  const pagination = receiptArchivePage(params?.page, total);
  const receipts = await prisma.mobileMoneyReceipt.findMany({
    where,
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    skip: pagination.skip,
    take: RECEIPT_ARCHIVE_PAGE_SIZE,
    select: {
      id: true,
      receivedAt: true,
      transactionAt: true,
      status: true,
      direction: true,
      providerLabel: true,
      providerReference: true,
      counterpartyLabel: true,
      amount: true,
      currency: true,
      assignedByName: true,
      paymentRequest: {
        select: { payerName: true, table: { select: { name: true } } },
      },
      customerCheckout: { select: { customerName: true } },
    },
  });

  function pageHref(page: number) {
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    if (status !== "all") query.set("status", status);
    if (q) query.set("q", q);
    query.set("page", String(page));
    return `/manager/payment-receipts?${query.toString()}`;
  }

  return (
    <main className="space-y-5 p-6">
      <div>
        <Link
          href="/manager"
          className="text-sm font-semibold text-blue-700 underline"
        >
          Back to manager
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Payment receipt history</h1>
        <p className="text-sm text-slate-600">
          Read-only mobile money records. Business days run from 7 AM to 7 AM
          Nairobi time.
        </p>
      </div>
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"
      >
        <label className="grid gap-1 text-sm font-medium">
          Business date
          <input
            name="date"
            type="date"
            defaultValue={date}
            className="rounded-lg border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Status
          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border px-3 py-2"
          >
            <option value="all">All</option>
            <option value="AVAILABLE">Available</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="OUTGOING">Outgoing</option>
            <option value="NEEDS_REVIEW">Needs review</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Reference or payer
          <input
            name="q"
            defaultValue={q}
            maxLength={100}
            className="rounded-lg border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Filter
        </button>
        <Link
          href="/manager/payment-receipts"
          className="py-2 text-sm underline"
        >
          Clear
        </Link>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="p-3">Transaction</th>
              <th className="p-3">Reference</th>
              <th className="p-3">Payer / recipient</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Assignment</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No matching receipts.
                </td>
              </tr>
            ) : (
              receipts.map((receipt) => (
                <tr key={receipt.id} className="border-t align-top">
                  <td className="p-3">
                    {dateFormatter.format(
                      receipt.transactionAt ?? receipt.receivedAt,
                    )}
                  </td>
                  <td className="p-3 font-mono">
                    {receipt.providerReference ?? "—"}
                  </td>
                  <td className="p-3">{receipt.counterpartyLabel ?? "—"}</td>
                  <td className="p-3">
                    {receipt.amount == null
                      ? "—"
                      : `${receipt.currency} ${Number(receipt.amount).toFixed(2)}`}
                  </td>
                  <td className="p-3">
                    {receipt.status.replaceAll("_", " ")} ·{" "}
                    {receipt.direction.toLowerCase()}
                  </td>
                  <td className="p-3">
                    {receipt.paymentRequest
                      ? `${receipt.paymentRequest.payerName} · ${receipt.paymentRequest.table.name}`
                      : (receipt.customerCheckout?.customerName ??
                        "Unassigned")}
                    {receipt.assignedByName ? (
                      <span className="block text-xs text-slate-500">
                        By {receipt.assignedByName}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-slate-600">
          <span>
            Showing {total === 0 ? 0 : pagination.skip + 1} to{" "}
            {Math.min(pagination.skip + receipts.length, total)} of {total}{" "}
            receipts
          </span>
          {pagination.pageCount > 1 ? (
            <nav
              aria-label="Receipt history pages"
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
      </div>
    </main>
  );
}
