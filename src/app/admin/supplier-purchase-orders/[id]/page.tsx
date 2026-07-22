import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import PurchaseOrderStatusActions from "./PurchaseOrderStatusActions";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function statusNotice(status: string | undefined) {
  switch (status) {
    case "created":
      return { tone: "success", message: "Purchase order created." };
    case "completed":
      return {
        tone: "success",
        message: "Purchase order completed and its invoice draft was created.",
      };
    case "cancelled":
      return { tone: "success", message: "Purchase order cancelled." };
    case "invoice_voided":
      return {
        tone: "success",
        message: "Invoice voided and purchase order reopened.",
      };
    case "not_open":
      return {
        tone: "error",
        message: "Only an open purchase order can be completed or cancelled.",
      };
    case "invalid_status":
      return {
        tone: "error",
        message: "Choose a valid purchase-order status.",
      };
    case "not_completed":
      return {
        tone: "error",
        message: "Only a completed purchase order can use invoice recovery.",
      };
    case "concurrent_change":
      return {
        tone: "error",
        message:
          "This purchase order changed while the invoice was being created. Refresh and try again.",
      };
    case "not_found":
    case "invoice_failed":
      return {
        tone: "error",
        message: "The invoice could not be created. Refresh and try again.",
      };
    default:
      return null;
  }
}

export default async function SupplierPurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ orderStatus?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await prisma.supplierPurchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { name: true, phone: true, email: true } },
      createdBy: { select: { fullName: true } },
      items: { orderBy: { createdAt: "asc" } },
      invoices: {
        select: { id: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!order) notFound();
  const notice = statusNotice(query?.orderStatus);
  const activeInvoice = order.invoices.find(
    (invoice) => invoice.status === "DRAFT" || invoice.status === "FINALIZED",
  );
  const statusTone =
    order.status === "COMPLETED"
      ? "green"
      : order.status === "CANCELLED"
        ? "red"
        : "amber";

  return (
    <AdminPage
      title={`Purchase order #${order.orderNumber}`}
      description={`${order.supplier.name} · expected ${DATE_FORMATTER.format(order.expectedDeliveryDate)}`}
      action={
        <>
          <Button asChild>
            <Link
              href={`/print/supplier-purchase-orders/${order.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Printable view
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/supplier-purchase-orders">
              Back to purchase orders
            </Link>
          </Button>
        </>
      }
    >
      {notice ? (
        <Alert variant={notice.tone === "error" ? "destructive" : "default"}>
          <AlertTitle>
            {notice.tone === "error"
              ? "Status not changed"
              : "Purchase order updated"}
          </AlertTitle>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <ToneBadge tone={statusTone}>{order.status}</ToneBadge>
        <span className="text-sm text-muted-foreground">
          Created {order.createdAt.toLocaleString()} by{" "}
          {order.createdBy.fullName}
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="gap-1 p-5">
          <div className="text-sm text-muted-foreground">Supplier</div>
          <div className="text-lg font-semibold">{order.supplier.name}</div>
          <div className="text-sm text-muted-foreground">
            {order.supplier.phone ||
              order.supplier.email ||
              "No contact recorded"}
          </div>
        </Card>
        <Card className="gap-1 p-5">
          <div className="text-sm text-muted-foreground">Expected delivery</div>
          <div className="text-lg font-semibold">
            {DATE_FORMATTER.format(order.expectedDeliveryDate)}
          </div>
        </Card>
        <Card className="gap-1 p-5">
          <div className="text-sm text-muted-foreground">Order total</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatMoney(Number(order.totalAmount))}
          </div>
        </Card>
      </section>

      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Item</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit price</TableHead>
              <TableHead>Line total</TableHead>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t">
                <TableCell className="font-semibold">{item.itemName}</TableCell>
                <TableCell>{item.itemUnit}</TableCell>
                <TableCell>{item.quantity.toString()}</TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(Number(item.unitPrice))}
                </TableCell>
                <TableCell className="font-semibold tabular-nums">
                  {formatMoney(Number(item.lineTotal))}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </DataTableCard>

      {order.notes ? (
        <Card className="p-5">
          <h2 className="font-semibold">Order notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {order.notes}
          </p>
        </Card>
      ) : null}

      {activeInvoice ? (
        <Card className="p-5">
          <h2 className="font-semibold">Linked supplier invoice</h2>
          <p className="text-sm text-muted-foreground">
            This purchase order has a {activeInvoice.status.toLowerCase()}{" "}
            invoice.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/admin/supplier-invoices/${activeInvoice.id}`}>
                Open invoice
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                href={`/print/supplier-invoices/${activeInvoice.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Print invoice
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {order.status === "OPEN" ? (
        <Card className="p-5">
          <h2 className="font-semibold">Order status</h2>
          <p className="text-sm text-muted-foreground">
            Completing this order creates an editable invoice draft. The draft
            does not update inventory or create money owed until it is
            finalized.
          </p>
          <PurchaseOrderStatusActions orderId={order.id} />
        </Card>
      ) : null}

      {order.status === "COMPLETED" && !activeInvoice ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Invoice not created</h2>
          <p className="text-sm text-amber-900">
            This order was completed before the invoice workflow was added. Use
            the recovery action to create its editable invoice draft.
          </p>
          <PurchaseOrderStatusActions orderId={order.id} mode="recovery" />
        </Card>
      ) : null}
    </AdminPage>
  );
}
