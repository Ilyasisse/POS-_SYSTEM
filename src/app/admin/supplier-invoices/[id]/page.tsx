import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, Button, Card, ToneBadge } from "@/components/admin/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { createSupplierReceiptUrl } from "@/lib/suppliers/storage";
import SupplierInvoiceEditor from "./SupplierInvoiceEditor";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function statusTone(status: "DRAFT" | "FINALIZED" | "VOID") {
  if (status === "FINALIZED") return "green" as const;
  if (status === "VOID") return "red" as const;
  return "amber" as const;
}

export default async function SupplierInvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ invoiceStatus?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const invoice = await prisma.supplierInvoice.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true } },
      purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
      items: { orderBy: { createdAt: "asc" } },
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
        },
      },
    },
  });
  if (!invoice) notFound();

  const [catalogItems, receiptUrl] = await Promise.all([
    prisma.supplierCatalogItem.findMany({
      where: { supplierId: invoice.supplierId },
      include: {
        product: { select: { name: true } },
        inventorySupply: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    invoice.receiptObjectPath
      ? createSupplierReceiptUrl(invoice.receiptObjectPath)
      : Promise.resolve(null),
  ]);

  return (
    <AdminPage
      title={
        invoice.invoiceNumber
          ? `Supplier invoice ${invoice.invoiceNumber}`
          : "Supplier invoice draft"
      }
      description={`${invoice.supplier.name} · ${invoice.purchaseOrder ? `PO #${invoice.purchaseOrder.orderNumber}` : "manual legacy invoice"}`}
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
      {query?.invoiceStatus === "finalized" ? (
        <Alert>
          <AlertTitle>Invoice finalized</AlertTitle>
          <AlertDescription>
            The invoice is now read-only and its unpaid supplier bill was
            created.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="gap-2 p-5">
          <span className="text-sm text-muted-foreground">Status</span>
          <div>
            <ToneBadge tone={statusTone(invoice.status)}>
              {invoice.status}
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
            Due {DATE_FORMATTER.format(invoice.dueDate)}
          </span>
        </Card>
        <Card className="gap-1 p-5">
          <span className="text-sm text-muted-foreground">Invoice total</span>
          <strong className="text-2xl tabular-nums">
            {formatMoney(Number(invoice.totalAmount))}
          </strong>
          <span className="text-xs text-muted-foreground">
            {invoice.bill
              ? `${invoice.bill.status} bill · ${formatMoney(Number(invoice.bill.totalAmount) - Number(invoice.bill.paidAmount))} remaining`
              : "No supplier bill until finalized"}
          </span>
        </Card>
      </section>

      {invoice.status !== "DRAFT" ? (
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
      ) : null}

      {receiptUrl ? (
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
      ) : null}

      <SupplierInvoiceEditor
        key={`${invoice.id}:${invoice.updatedAt.toISOString()}`}
        hasPurchaseOrder={Boolean(invoice.purchaseOrder)}
        invoice={{
          id: invoice.id,
          status: invoice.status,
          invoiceNumber: invoice.invoiceNumber || "",
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          dueDate: invoice.dueDate.toISOString().slice(0, 10),
          notes: invoice.notes || "",
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
          isActive: item.isActive,
        }))}
      />
    </AdminPage>
  );
}
