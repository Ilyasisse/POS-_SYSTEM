import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
export const dynamic = "force-dynamic";
export default async function CashierStatusPage() {
  await requirePermission(PERMISSIONS.STAFF_MANAGE);
  const [cashiers, history, unassigned] = await Promise.all([
    prisma.staff.findMany({ where: { role: "CASHIER" }, select: { id: true, fullName: true, isActive: true, availability: true, lastSeenAt: true }, orderBy: { fullName: "asc" } }),
    prisma.auditLog.findMany({ where: { action: "staff.availability_changed" }, include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.order.findMany({ where: { customerCheckout: { is: { status: "PAID" } }, waiterId: null, cashierId: null, kitchenTicketState: { is: { pickupStatus: { not: "DELIVERED" } } } }, select: { id: true, orderNumber: true }, orderBy: { createdAt: "asc" } }),
  ]);
  // eslint-disable-next-line react-hooks/purity -- This dynamic server page takes a fresh presence snapshot per request.
  const observedAt = Date.now();
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <h1 className="text-2xl font-bold">Cashier status and audit history</h1>
    <p className="text-sm text-muted-foreground">Refresh this page for current status. A cashier must be available and seen within 90 seconds to receive a new order.</p>
    <table className="w-full text-left"><thead><tr><th>Name</th><th>Selected status</th><th>Connection</th><th>Last seen (UTC)</th></tr></thead>
      <tbody>{cashiers.map(cashier => <tr key={cashier.id}><td>{cashier.fullName}</td><td>{cashier.availability}</td><td>{cashier.isActive && cashier.lastSeenAt && observedAt - cashier.lastSeenAt.getTime() <= 90_000 ? "Online" : "Offline"}</td><td>{cashier.lastSeenAt?.toISOString() ?? "Never"}</td></tr>)}</tbody>
    </table>
    <h2 className="text-xl font-semibold">Orders needing staff assignment</h2>
    {unassigned.length ? <p>Paid orders: {unassigned.map(order => `#${order.orderNumber}`).join(", ")}. Staff can handle these on the customer payment page.</p> : <p>All open paid customer orders have an assigned staff member.</p>}
    <h2 className="text-xl font-semibold">Status audit log</h2>
    <ol className="space-y-2">{history.map(event => <li key={event.id} className="rounded-lg border p-3">{event.actor?.fullName ?? "Staff"} · {event.createdAt.toISOString()}<pre className="whitespace-pre-wrap text-xs">{JSON.stringify({ previous: event.previousValue, next: event.newValue })}</pre></li>)}</ol>
  </main>;
}
