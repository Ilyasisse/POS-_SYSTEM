import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminPage,
  Button,
  Card,
  MetricCard,
  Table,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.REPORT_CUSTOMER_VIEW);
  const { id } = await params;
  const [customer, orders, orderSummary, favorites, feedback] = await Promise.all([
    prisma.user.findFirst({
      where: { id, role: "CUSTOMER" },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        orderItems: { select: { productName: true, qty: true, lineTotal: true } },
        payments: { select: { method: true, amountPaid: true } },
      },
    }),
    prisma.order.aggregate({
      where: { customerId: id, status: "PAID" },
      _count: true,
      _sum: { total: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: { customerId: id, status: "PAID" } },
      _sum: { qty: true, lineTotal: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 5,
    }),
    prisma.customerFeedback.aggregate({
      where: { createdByUserId: id, rating: { not: null } },
      _avg: { rating: true },
      _count: true,
    }),
  ]);
  if (!customer) notFound();

  const paidVisits = orderSummary._count;
  const lifetimeSpend = Number(orderSummary._sum.total ?? 0);
  const averageOrder = paidVisits ? lifetimeSpend / paidVisits : 0;

  return (
    <AdminPage
      title={customer.fullName}
      description="Customer contact details, preferences, and identified order history."
      action={<Button asChild variant="outline"><Link href="/admin/customers">Back to customers</Link></Button>}
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Paid visits" value={paidVisits} />
        <MetricCard label="Lifetime spend" value={money(lifetimeSpend)} />
        <MetricCard label="Average order" value={money(averageOrder)} />
        <MetricCard
          label="Average rating"
          value={feedback._count ? `${Number(feedback._avg.rating).toFixed(1)} / 5` : "No ratings"}
          helper={feedback._count ? `${feedback._count} submitted rating${feedback._count === 1 ? "" : "s"}` : undefined}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-5">
          <div>
            <h2 className="font-semibold">Contact profile</h2>
            <p className="text-sm text-muted-foreground">Registered {customer.createdAt.toLocaleDateString()}</p>
          </div>
          <dl className="grid gap-4 text-sm">
            <div><dt className="text-muted-foreground">Email</dt><dd className="font-medium break-all">{customer.email}</dd></div>
            <div><dt className="text-muted-foreground">Phone</dt><dd className="font-medium">{customer.phoneNumber ?? "Not provided"}</dd></div>
            <div><dt className="text-muted-foreground">Account</dt><dd><ToneBadge tone={customer.isActive ? "green" : "slate"}>{customer.isActive ? "Active" : "Inactive"}</ToneBadge></dd></div>
          </dl>
        </Card>

        <Card className="p-5">
          <div>
            <h2 className="font-semibold">Favorite products</h2>
            <p className="text-sm text-muted-foreground">Ranked by quantity in paid identified orders.</p>
          </div>
          {favorites.length ? (
            <ol className="space-y-3">
              {favorites.map((favorite, index) => (
                <li key={favorite.productId} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div><span className="mr-3 text-sm text-muted-foreground">#{index + 1}</span><strong>{favorite.productName}</strong></div>
                  <div className="text-right text-sm"><p>{favorite._sum.qty ?? 0} ordered</p><p className="text-muted-foreground">{money(favorite._sum.lineTotal)}</p></div>
                </li>
              ))}
            </ol>
          ) : <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No paid product history yet.</p>}
        </Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-5 py-4"><h2 className="font-semibold">Recent orders</h2><p className="text-sm text-muted-foreground">Up to the latest 50 identified orders.</p></div>
        {orders.length ? (
          <Table>
            <thead><tr><TableHead>Order</TableHead><TableHead>Date</TableHead><TableHead>Items</TableHead><TableHead>Payment</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b">
                  <TableCell className="font-semibold">#{order.orderNumber}</TableCell>
                  <TableCell>{order.createdAt.toLocaleString()}</TableCell>
                  <TableCell><p>{order.orderItems.reduce((sum, item) => sum + item.qty, 0)} items</p><p className="max-w-xs truncate text-xs text-muted-foreground">{order.orderItems.map((item) => item.productName).join(", ")}</p></TableCell>
                  <TableCell>{order.payments.length ? [...new Set(order.payments.map((payment) => payment.method))].join(", ") : "Unpaid"}</TableCell>
                  <TableCell>{money(order.total)}</TableCell>
                  <TableCell><ToneBadge tone={order.status === "PAID" ? "green" : order.status === "OPEN" ? "amber" : "red"}>{order.status}</ToneBadge></TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <p className="m-5 rounded-lg bg-muted p-4 text-sm text-muted-foreground">No identified orders for this customer.</p>}
      </Card>
    </AdminPage>
  );
}
