import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, Button, Card, ToneBadge } from "@/components/admin/shared";
import { ToastOnMount } from "@/components/ui/toast";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { isDailyCashLocked } from "@/lib/daily-cash/business-date";
import { prisma } from "@/lib/prisma";
import { formatSupplierInvoiceNumber } from "@/lib/suppliers/invoice-number";
import {
  getSupplierInvoiceDisplayStatus,
  SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS,
  SUPPLIER_INVOICE_DISPLAY_STATUS_TONES,
  SUPPLIER_INVOICE_SOURCE_LABELS,
} from "@/lib/suppliers/invoice-status";
import { getSupplierPaymentReversalError } from "@/lib/suppliers/payment-reversal";
import {
  getSupplierBillDefaultDueDateKey,
  getSupplierPurchaseTodayDateKey,
} from "@/lib/suppliers/purchase-orders";
import { createSupplierReceiptUrl } from "@/lib/suppliers/storage";
import { formatBusinessDateKey } from "@/lib/waiter/waiter-balance-calculations";
import RevertPaymentButton from "@/app/admin/reports/supplier-bills/RevertPaymentButton";
import RecurringInvoiceCard from "./RecurringInvoiceCard";
import SupplierInvoiceEditor from "./SupplierInvoiceEditor";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Africa/Nairobi",
  dateStyle: "medium",
  timeStyle: "short",
});

async function findSupplierInvoice(id: string) {
  return prisma.supplierInvoice.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true } },
      purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
      templateRecurrence: {
        include: { _count: { select: { generatedInvoices: true } } },
      },
      generatedByRecurrence: {
        select: {
          sourceInvoice: { select: { id: true, invoiceNumber: true } },
        },
      },
      items: { orderBy: { createdAt: "asc" } },
      installments: { orderBy: [{ dueDate: "asc" }, { sequence: "asc" }] },
      createdBy: { select: { fullName: true } },
      finalizedBy: { select: { fullName: true } },
      voidedBy: { select: { fullName: true } },
      bill: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          dueDate: true,
          allocations: {
            select: {
              id: true,
              amount: true,
              installmentId: true,
              supplierPayment: {
                select: {
                  id: true,
                  amount: true,
                  paymentMethod: true,
                  paidAt: true,
                  recordedBy: { select: { fullName: true } },
                  dailyCashPayment: {
                    select: {
                      dailyCashDay: { select: { businessDate: true } },
                    },
                  },
                },
              },
            },
            orderBy: { allocatedAt: "desc" },
          },
        },
      },
    },
  });
}

type SupplierInvoiceDetail = NonNullable<
  Awaited<ReturnType<typeof findSupplierInvoice>>
>;
type InvoicePaymentRecord = NonNullable<
  SupplierInvoiceDetail["bill"]
>["allocations"][number]["supplierPayment"];
type InvoicePaymentRow = Omit<InvoicePaymentRecord, "dailyCashPayment"> & {
  allocatedAmount: number;
  legacyAllocationAfterSchedule: boolean;
  dailyCashBusinessDate: string | null;
  reversalError: string | null;
};

function InvoiceSummaryCards({
  invoice,
  displayStatus,
  effectiveDueDate,
  remainingBalance,
}: {
  invoice: SupplierInvoiceDetail;
  displayStatus: ReturnType<typeof getSupplierInvoiceDisplayStatus>;
  effectiveDueDate: Date;
  remainingBalance: number | null;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-4">
      <Card className="gap-2 p-5">
        <span className="text-sm text-muted-foreground">Status</span>
        <div>
          <ToneBadge
            tone={SUPPLIER_INVOICE_DISPLAY_STATUS_TONES[displayStatus]}
          >
            {SUPPLIER_INVOICE_DISPLAY_STATUS_LABELS[displayStatus]}
          </ToneBadge>
        </div>
      </Card>
      <Card className="gap-1 p-5">
        <span className="text-sm text-muted-foreground">Supplier</span>
        <strong>{invoice.supplier.name}</strong>
        <span className="text-xs text-muted-foreground">
          {invoice.supplier.phone ||
            invoice.supplier.email ||
            "No contact recorded"}
        </span>
      </Card>
      <Card className="gap-1 p-5">
        <span className="text-sm text-muted-foreground">Invoice date</span>
        <strong>{DATE_FORMATTER.format(invoice.invoiceDate)}</strong>
        <span className="text-xs text-muted-foreground">
          Due {DATE_FORMATTER.format(effectiveDueDate)}
        </span>
      </Card>
      <Card className="gap-1 p-5">
        <span className="text-sm text-muted-foreground">Invoice total</span>
        <strong className="text-2xl tabular-nums">
          {formatMoney(Number(invoice.totalAmount))}
        </strong>
        <span className="text-xs text-muted-foreground">
          {invoice.bill
            ? displayStatus === "PAID"
              ? "Paid in full"
              : `${formatMoney(remainingBalance || 0)} remaining`
            : invoice.status === "VOID"
              ? "Invoice voided"
              : "No supplier bill until finalized"}
        </span>
      </Card>
    </section>
  );
}

function InvoicePaymentsCard({ payments }: { payments: InvoicePaymentRow[] }) {
  if (!payments.length) return null;

  return (
    <Card className="gap-3 p-5">
      <div>
        <h2 className="font-semibold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Recorded payments for this supplier invoice.
        </p>
      </div>
      <div className="grid gap-2">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <div className="font-semibold tabular-nums">
                {formatMoney(Number(payment.amount))}
              </div>
              <div className="text-muted-foreground">
                {payment.paymentMethod || "Unspecified method"} ·{" "}
                {payment.recordedBy.fullName} · {payment.paidAt.toLocaleString()}
              </div>
              {payment.dailyCashBusinessDate ? (
                <div className="text-xs text-muted-foreground">
                  Daily Cash {payment.dailyCashBusinessDate}
                </div>
              ) : null}
            </div>
            <RevertPaymentButton
              paymentId={payment.id}
              amount={formatMoney(Number(payment.amount))}
              disabledReason={payment.reversalError}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function InvoiceInstallmentSchedule({
  invoice,
}: {
  invoice: SupplierInvoiceDetail;
}) {
  if (!invoice.installments.length) return null;

  return (
    <Card className="gap-3 p-5">
      <h2 className="font-semibold">Installment schedule</h2>
      <div className="grid gap-2 md:grid-cols-3">
        {invoice.installments.map((installment) => {
          const remaining =
            Number(installment.amount) - Number(installment.paidAmount);
          return (
            <div key={installment.id} className="rounded-lg border p-3 text-sm">
              <div className="font-semibold">
                {DATE_FORMATTER.format(installment.dueDate)}
              </div>
              <div>{formatMoney(Number(installment.amount))}</div>
              <div className="text-muted-foreground">
                {formatMoney(remaining)} remaining · {installment.status}
              </div>
            </div>
          );
        })}
      </div>
      {invoice.bill ? (
        <Button asChild variant="outline" className="w-fit">
          <Link
            href={`/admin/reports/supplier-bills?supplier=${invoice.supplierId}`}
          >
            Manage installments and payments
          </Link>
        </Button>
      ) : null}
    </Card>
  );
}

function InvoiceAuditCard({ invoice }: { invoice: SupplierInvoiceDetail }) {
  if (invoice.status === "DRAFT") return null;

  return (
    <Card className="gap-2 p-5 text-sm">
      <h2 className="font-semibold">Invoice audit</h2>
      <p>
        Created by {invoice.createdBy?.fullName || "Legacy import"} on{" "}
        {invoice.createdAt.toLocaleString()}.
      </p>
      {invoice.finalizedAt ? (
        <p>
          Finalized by {invoice.finalizedBy?.fullName || "Unknown user"} on{" "}
          {invoice.finalizedAt.toLocaleString()}.
        </p>
      ) : null}
      {invoice.voidedAt ? (
        <p>
          Voided by {invoice.voidedBy?.fullName || "Unknown user"} on{" "}
          {invoice.voidedAt.toLocaleString()}.
          {invoice.voidReason ? ` Reason: ${invoice.voidReason}` : ""}
        </p>
      ) : null}
      {invoice.source === "LEGACY_UPLOAD" ? (
        <>
          <p>
            Converted from the former supplier delivery workflow with its
            original record ID and receipt reference.
          </p>
          {invoice.legacyDeliveryDate ? (
            <p>
              Original delivery timestamp:{" "}
              {invoice.legacyDeliveryDate.toLocaleString()}.
            </p>
          ) : null}
          {invoice.legacyInventoryUpdatedAt ? (
            <p>
              Historical inventory update:{" "}
              {invoice.legacyInventoryUpdatedAt.toLocaleString()}. This is
              audit history only; invoices no longer update inventory.
            </p>
          ) : null}
          {invoice.legacySubtotalAmount !== null ||
          invoice.legacyTaxAmount !== null ||
          invoice.legacyDiscountAmount !== null ? (
            <p>
              Legacy breakdown: subtotal{" "}
              {formatMoney(Number(invoice.legacySubtotalAmount || 0))}, tax{" "}
              {formatMoney(Number(invoice.legacyTaxAmount || 0))}, discount{" "}
              {formatMoney(Number(invoice.legacyDiscountAmount || 0))}.
            </p>
          ) : null}
        </>
      ) : null}
      {invoice.bill ? (
        <Button asChild variant="outline" className="mt-2 w-fit">
          <Link
            href={`/admin/reports/supplier-bills?supplier=${invoice.supplierId}`}
          >
            Open supplier bill
          </Link>
        </Button>
      ) : null}
    </Card>
  );
}

function ReceiptReferenceCard({ receiptUrl }: { receiptUrl: string | null }) {
  if (!receiptUrl) return null;

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Receipt reference</h2>
      <a
        href={receiptUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-semibold text-primary hover:underline"
      >
        Open receipt image
      </a>
    </Card>
  );
}

function RecurringDraftSourceCard({
  invoice,
}: {
  invoice: SupplierInvoiceDetail;
}) {
  if (!invoice.generatedByRecurrence) return null;

  const sourceInvoice = invoice.generatedByRecurrence.sourceInvoice;
  return (
    <Card className="gap-2 p-5">
      <h2 className="font-semibold">Recurring draft</h2>
      <p className="text-sm text-muted-foreground">
        This draft was generated from a recurring supplier invoice template.
      </p>
      <Button asChild variant="outline" className="w-fit">
        <Link href={`/admin/supplier-invoices/${sourceInvoice.id}`}>
          Open source invoice
          {` ${formatSupplierInvoiceNumber(sourceInvoice.invoiceNumber)}`}
        </Link>
      </Button>
    </Card>
  );
}

export default async function SupplierInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ invoiceStatus?: string }>;
}) {
  const currentUser = await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const invoice = await findSupplierInvoice(id);
  if (!invoice) notFound();
  const formattedInvoiceNumber = formatSupplierInvoiceNumber(
    invoice.invoiceNumber,
  );
  const displayStatus = getSupplierInvoiceDisplayStatus(invoice);
  const effectiveDueDate = invoice.bill?.dueDate ?? invoice.dueDate;
  const remainingBalance = invoice.bill
    ? Number(invoice.bill.totalAmount) - Number(invoice.bill.paidAmount)
    : null;
  const billPayments = [
    ...(invoice.bill?.allocations ?? [])
      .reduce((grouped, allocation) => {
        const payment = allocation.supplierPayment;
        const existing = grouped.get(payment.id);
        if (existing) {
          existing.allocatedAmount += Number(allocation.amount);
          existing.legacyAllocationAfterSchedule ||=
            !allocation.installmentId && invoice.installments.length > 0;
          return grouped;
        }
        const dailyCashBusinessDate = payment.dailyCashPayment
          ? formatBusinessDateKey(
              payment.dailyCashPayment.dailyCashDay.businessDate,
            )
          : null;
        grouped.set(payment.id, {
          ...payment,
          allocatedAmount: Number(allocation.amount),
          legacyAllocationAfterSchedule:
            !allocation.installmentId && invoice.installments.length > 0,
          dailyCashBusinessDate,
          reversalError: getSupplierPaymentReversalError({
            legacyAllocationAfterSchedule:
              !allocation.installmentId && invoice.installments.length > 0,
            dailyCashLinked: Boolean(payment.dailyCashPayment),
            dailyCashLocked: dailyCashBusinessDate
              ? isDailyCashLocked(dailyCashBusinessDate)
              : false,
            canManageDailyCash: hasPermission(
              currentUser,
              PERMISSIONS.DAILY_CASH_MANAGE,
            ),
          }),
        });
        return grouped;
      }, new Map<string, InvoicePaymentRow>())
      .values(),
  ];

  const [catalogItems, receiptUrl] = await Promise.all([
    prisma.supplierCatalogItem.findMany({
      where: { supplierId: invoice.supplierId },
      include: {
        product: { select: { name: true, isActive: true } },
        inventorySupply: { select: { name: true, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    invoice.receiptObjectPath
      ? createSupplierReceiptUrl(invoice.receiptObjectPath)
      : Promise.resolve(null),
  ]);

  return (
    <AdminPage
      title={`Supplier invoice ${formattedInvoiceNumber}`}
      description={`${invoice.supplier.name} · ${SUPPLIER_INVOICE_SOURCE_LABELS[invoice.source]}`}
      action={
        <>
          <Button asChild>
            <Link
              href={`/print/supplier-invoices/${invoice.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Printable view
            </Link>
          </Button>
          {invoice.purchaseOrder ? (
            <Button asChild variant="outline">
              <Link
                href={`/admin/supplier-purchase-orders/${invoice.purchaseOrder.id}`}
              >
                Open purchase order
              </Link>
            </Button>
          ) : null}
        </>
      }
    >
      {query?.invoiceStatus === "approved" ? (
        <ToastOnMount
          tone="success"
          title="Invoice approved"
          description="The invoice is now read-only, its supplier bill was created, and payment is pending."
        />
      ) : null}
      {query?.invoiceStatus === "created" ? (
        <ToastOnMount
          tone="success"
          title="Invoice draft created"
          description="Review the invoice details, then save or finalize it when ready."
        />
      ) : null}
      {query?.invoiceStatus === "voided" ? (
        <ToastOnMount
          tone="success"
          title="Invoice voided"
          description="The invoice draft was voided."
        />
      ) : null}

      <InvoiceSummaryCards
        invoice={invoice}
        displayStatus={displayStatus}
        effectiveDueDate={effectiveDueDate}
        remainingBalance={remainingBalance}
      />
      <InvoicePaymentsCard payments={billPayments} />
      <InvoiceInstallmentSchedule invoice={invoice} />
      <InvoiceAuditCard invoice={invoice} />
      <ReceiptReferenceCard receiptUrl={receiptUrl} />
      <RecurringDraftSourceCard invoice={invoice} />

      <RecurringInvoiceCard
        invoiceId={invoice.id}
        eligible={
          invoice.source === "MANUAL" &&
          invoice.status !== "VOID" &&
          invoice.items.length > 0 &&
          invoice.items.every((item) => Boolean(item.supplierCatalogItemId))
        }
        todayDateKey={getSupplierPurchaseTodayDateKey()}
        defaultNextRunDate={getSupplierBillDefaultDueDateKey()}
        recurrence={
          invoice.templateRecurrence
            ? {
                id: invoice.templateRecurrence.id,
                interval: invoice.templateRecurrence.interval,
                unit: invoice.templateRecurrence.unit,
                nextRunDate: invoice.templateRecurrence.nextRunDate
                  .toISOString()
                  .slice(0, 10),
                isActive: invoice.templateRecurrence.isActive,
                lastGeneratedAtLabel: invoice.templateRecurrence.lastGeneratedAt
                  ? DATE_TIME_FORMATTER.format(
                      invoice.templateRecurrence.lastGeneratedAt,
                    )
                  : null,
                lastError: invoice.templateRecurrence.lastError,
                lastErrorAtLabel: invoice.templateRecurrence.lastErrorAt
                  ? DATE_TIME_FORMATTER.format(
                      invoice.templateRecurrence.lastErrorAt,
                    )
                  : null,
                pausedAt:
                  invoice.templateRecurrence.pausedAt?.toISOString() ?? null,
                generatedCount:
                  invoice.templateRecurrence._count.generatedInvoices,
              }
            : null
        }
      />

      <SupplierInvoiceEditor
        key={`${invoice.id}:${invoice.updatedAt.toISOString()}`}
        hasPurchaseOrder={Boolean(invoice.purchaseOrder)}
        source={invoice.source}
        invoice={{
          id: invoice.id,
          status: invoice.status,
          invoiceNumber: formattedInvoiceNumber,
          supplierReference: invoice.supplierReference || "",
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          dueDate: invoice.dueDate.toISOString().slice(0, 10),
          notes: invoice.notes || "",
          installments: invoice.installments.map((installment) => ({
            id: installment.id,
            dueDate: installment.dueDate.toISOString().slice(0, 10),
            amount: installment.amount.toString(),
          })),
          items: invoice.items.map((item) => ({
            key: item.id,
            kind: item.supplierCatalogItemId ? "catalog" : "custom",
            catalogItemId: item.supplierCatalogItemId || "",
            itemName: item.itemName,
            itemUnit: item.itemUnit,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            notes: item.notes || "",
          })),
        }}
        catalog={catalogItems.map((item) => ({
          id: item.id,
          itemName:
            item.product?.name ||
            item.inventorySupply?.name ||
            "Unavailable item",
          itemUnit: item.unit,
          unitPrice: item.unitPrice.toString(),
          isActive:
            item.isActive &&
            Boolean(item.product?.isActive || item.inventorySupply?.isActive),
        }))}
      />
    </AdminPage>
  );
}
