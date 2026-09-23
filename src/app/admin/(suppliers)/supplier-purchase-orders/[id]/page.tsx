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
import { ToastOnMount } from "@/components/ui/toast";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import { deliveryDifference } from "@/lib/suppliers/receiving";
import { recordSupplierDeliveryAction } from "../actions";
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
    case "delivery_recorded":
      return {
        tone: "success",
        message:
          "Delivery count recorded. Review the shortages and extras below.",
      };
    case "delivery_unavailable":
      return {
        tone: "warning",
        message:
          "This delivery was already recorded or the purchase order is no longer completed. Refresh to see its latest status.",
      };
    case "invalid_delivery":
      return {
        tone: "error",
        message:
          "Enter valid received quantities for every item. Explain any shortage or extra quantity in the delivery note.",
      };
    case "delivery_failed":
      return {
        tone: "error",
        message: "Could not record the delivery. Refresh and try again.",
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
      receiving: {
        include: {
          receivedBy: { select: { fullName: true } },
          items: {
            select: {
              purchaseOrderItemId: true,
              expectedQuantity: true,
              receivedQuantity: true,
            },
          },
        },
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
        <ToastOnMount
          tone={notice.tone as "success" | "error"}
          title={
            notice.tone === "error"
              ? "Status not changed"
              : "Purchase order updated"
          }
          description={notice.message}
        />
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

      {order.receiving ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Delivery count</h2>
          <p className="text-sm text-muted-foreground">
            Recorded {order.receiving.receivedAt.toLocaleString()} by{" "}
            {order.receiving.receivedBy.fullName}. These are delivery quantities
            only; recording them does not update inventory or change the
            supplier invoice.
          </p>
          <DataTableCard>
            <Table>
              <thead>
                <tr>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Difference</TableHead>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => {
                  const count = order.receiving!.items.find(
                    (entry) => entry.purchaseOrderItemId === item.id,
                  );
                  const difference = count
                    ? deliveryDifference(
                        count.expectedQuantity,
                        count.receivedQuantity,
                      )
                    : null;
                  return (
                    <tr key={item.id} className="border-t">
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell>{item.itemUnit}</TableCell>
                      <TableCell>
                        {count?.expectedQuantity.toString() ??
                          item.quantity.toString()}
                      </TableCell>
                      <TableCell>
                        {count?.receivedQuantity.toString() ?? "Not recorded"}
                      </TableCell>
                      <TableCell>
                        {difference
                          ? `${difference.status}${difference.status === "Matched" ? "" : ` ${difference.quantity}`}`
                          : "Not recorded"}
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </DataTableCard>
          {order.receiving.qualityRating ? (
            <p className="text-sm">
              Quality: {order.receiving.qualityRating}/5
            </p>
          ) : null}
          {order.receiving.completionNote ? (
            <p className="whitespace-pre-wrap text-sm">
              Note: {order.receiving.completionNote}
            </p>
          ) : null}
        </Card>
      ) : order.status === "COMPLETED" ? (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Record supplier delivery</h2>
          <p className="text-sm text-muted-foreground">
            Count what arrived in the same units as the purchase order. Use zero
            for an item that did not arrive. This permanent delivery record does
            not update inventory or the invoice.
          </p>
          <form action={recordSupplierDeliveryAction} className="space-y-4">
            <input type="hidden" name="id" value={order.id} />
            {order.items.map((item) => (
              <label
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {item.itemName} · ordered {item.quantity.toString()}{" "}
                  {item.itemUnit}
                </span>
                <input
                  className="w-36 rounded border px-3 py-2"
                  aria-label={`Received ${item.itemName}`}
                  name={`received-${item.id}`}
                  type="number"
                  min="0"
                  step="0.001"
                  max="999999999.999"
                  defaultValue={item.quantity.toString()}
                  required
                />
              </label>
            ))}
            <label className="block space-y-1 text-sm">
              <span>Quality rating (optional)</span>
              <select
                name="qualityRating"
                defaultValue=""
                className="block rounded border px-3 py-2"
              >
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}/5
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span>Delivery note (required if quantities differ)</span>
              <textarea
                name="completionNote"
                maxLength={2000}
                className="block w-full rounded border px-3 py-2"
                rows={3}
                placeholder="Describe missing, damaged, or extra items"
              />
            </label>
            <Button type="submit">Save delivery count</Button>
          </form>
        </Card>
      ) : null}

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
