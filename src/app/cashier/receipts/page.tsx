import Link from "next/link";
import { Printer, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { getCashierBusinessDayRange } from "@/lib/cashier/cashier-business-day";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;

export default async function CashierReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; scope?: string }>;
}) {
  await requirePermission(PERMISSIONS.ORDER_VIEW_ALL);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const allTime = params.scope === "all";
  const { start, end } = getCashierBusinessDayRange();
  const orderNumber = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : undefined;
  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      ...(allTime ? {} : { closedAt: { gte: start, lt: end } }),
      ...(orderNumber ? { orderNumber } : {}),
    },
    orderBy: { closedAt: "desc" },
    take: 50,
    include: {
      table: { select: { name: true } },
      customer: { select: { fullName: true } },
      waiter: { select: { fullName: true } },
      cashier: { select: { fullName: true } },
      payments: { select: { method: true } },
      _count: { select: { orderItems: true } },
    },
  });

  return (
    <main className="min-h-dvh bg-muted/35 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cashier</p>
            <h1 className="text-3xl font-bold">Customer receipts</h1>
            <p className="mt-1 text-sm text-muted-foreground">Find, review, and reprint paid order receipts.</p>
          </div>
          <Button asChild variant="outline"><Link href="/cashier">Back to cashier</Link></Button>
        </header>

        <Card className="p-4">
          <form className="flex flex-col gap-3 sm:flex-row">
            <Input name="q" defaultValue={q} inputMode="numeric" placeholder="Order number, for example #123" className="flex-1" />
            <select name="scope" defaultValue={allTime ? "all" : "today"} className="h-10 rounded-lg border bg-background px-3 text-sm">
              <option value="today">Current business day</option>
              <option value="all">All time</option>
            </select>
            <Button type="submit">Search</Button>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
          {orders.length ? (
            <Table>
              <thead><tr><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Service</TableHead><TableHead>Items</TableHead><TableHead>Payment</TableHead><TableHead>Total</TableHead><TableHead>Closed</TableHead><TableHead>Receipt</TableHead></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b">
                    <TableCell className="font-semibold">#{order.orderNumber}</TableCell>
                    <TableCell>{order.customer?.fullName ?? "Walk-in"}</TableCell>
                    <TableCell><p>{order.table?.name ?? order.type.replace("_", " ")}</p><p className="text-xs text-muted-foreground">{order.waiter?.fullName ?? order.cashier?.fullName ?? "Cafe staff"}</p></TableCell>
                    <TableCell>{order._count.orderItems}</TableCell>
                    <TableCell>{[...new Set(order.payments.map((payment) => payment.method))].join(", ") || "—"}</TableCell>
                    <TableCell>{money(order.total)}</TableCell>
                    <TableCell>{order.closedAt?.toLocaleString() ?? "—"}</TableCell>
                    <TableCell><Button asChild size="sm" variant="outline"><Link href={`/print/orders/${order.id}`}><Printer /> Print</Link></Button></TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState icon={ReceiptText} title="No paid receipts found" description={q ? "Check the order number or search all time." : "Paid orders will appear here after checkout."} className="m-4" />
          )}
        </Card>
      </div>
    </main>
  );
}
