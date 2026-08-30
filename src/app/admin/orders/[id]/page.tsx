import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminPage,
  Button,
  Card,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import OrderAdjustmentForm from "./OrderAdjustmentForm";

function money(value: { toString(): string } | number) {
  return `$${Number(value).toFixed(2)}`;
}

export default async function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, currentUser] = await Promise.all([
    params,
    requirePermission(PERMISSIONS.ADMIN_ACCESS),
  ]);
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      table: { select: { name: true } },
      waiter: { select: { fullName: true } },
      cashier: { select: { fullName: true } },
      orderItems: {
        orderBy: { createdAt: "asc" },
        include: { modifiers: true },
      },
      payments: { orderBy: { createdAt: "asc" } },
      salesAdjustments: {
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { fullName: true } },
          approvedBy: { select: { fullName: true } },
          orderItem: { select: { productName: true } },
        },
      },
    },
  });
  if (!order) notFound();

  const subtotal = order.orderItems.reduce(
    (sum, item) => sum + Number(item.lineTotal),
    0,
  );
  const paid = order.payments.reduce(
    (sum, payment) => sum + Number(payment.amountPaid),
    0,
  );

  return (
    <AdminPage
      title={`Order #${order.orderNumber}`}
      description="Review the order, payments, and approved adjustments."
      action={<Button asChild variant="outline"><Link href="/admin/orders">Back to orders</Link></Button>}
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-1 p-5"><p className="text-sm text-muted-foreground">Status</p><ToneBadge tone={order.status === "PAID" ? "green" : order.status === "OPEN" ? "amber" : "red"}>{order.status}</ToneBadge></Card>
        <Card className="gap-1 p-5"><p className="text-sm text-muted-foreground">Current total</p><p className="text-2xl font-semibold">{money(order.total)}</p></Card>
        <Card className="gap-1 p-5"><p className="text-sm text-muted-foreground">Paid</p><p className="text-2xl font-semibold">{money(paid)}</p></Card>
        <Card className="gap-1 p-5"><p className="text-sm text-muted-foreground">Table / staff</p><p className="font-semibold">{order.table?.name ?? order.type.replace("_", "-")}</p><p className="text-xs text-muted-foreground">{order.waiter?.fullName ?? order.cashier?.fullName ?? "Walk-in"}</p></Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-5 py-4"><h2 className="font-semibold">Order items</h2><p className="text-sm text-muted-foreground">Original subtotal: {money(subtotal)}</p></div>
        <Table>
          <thead><tr><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Unit price</TableHead><TableHead>Total</TableHead></tr></thead>
          <tbody>
            {order.orderItems.map((item) => (
              <tr key={item.id} className="border-b">
                <TableCell><p className="font-medium">{item.productName}</p>{item.modifiers.length ? <p className="text-xs text-muted-foreground">{item.modifiers.map((modifier) => modifier.modifierName).join(", ")}</p> : null}</TableCell>
                <TableCell>{item.qty}</TableCell><TableCell>{money(item.unitPrice)}</TableCell><TableCell>{money(item.lineTotal)}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
        <Card className="p-5">
          <div><h2 className="font-semibold">Adjustment history</h2><p className="text-sm text-muted-foreground">Every action records its reason and approver.</p></div>
          {order.salesAdjustments.length ? (
            <div className="divide-y">
              {order.salesAdjustments.map((adjustment) => (
                <div key={adjustment.id} className="space-y-1 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3"><ToneBadge tone={adjustment.type === "REFUND" || adjustment.type === "VOID" ? "red" : "blue"}>{adjustment.type.replace("_", " ")}</ToneBadge><strong>{money(adjustment.amount)}</strong></div>
                  <p>{adjustment.reason}</p>
                  <p className="text-xs text-muted-foreground">{adjustment.orderItem?.productName ? `${adjustment.orderItem.productName} · ` : ""}Approved by {adjustment.approvedBy.fullName} · {adjustment.createdAt.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No adjustments recorded.</p>}
        </Card>

        <Card className="p-5">
          <div><h2 className="font-semibold">Record adjustment</h2><p className="text-sm text-muted-foreground">Sensitive actions require the correct manager permission.</p></div>
          <OrderAdjustmentForm
            orderId={order.id}
            orderStatus={order.status}
            orderTotal={order.total.toFixed(2)}
            lines={order.orderItems.map((item) => ({ id: item.id, label: `${item.qty}× ${item.productName} — ${money(item.lineTotal)}`, lineTotal: item.lineTotal.toFixed(2) }))}
            canApproveOperational={hasPermission(currentUser, PERMISSIONS.ADJUSTMENT_OPERATIONAL_APPROVE)}
            canApproveFinancial={hasPermission(currentUser, PERMISSIONS.ADJUSTMENT_FINANCIAL_APPROVE)}
          />
        </Card>
      </section>
    </AdminPage>
  );
}
