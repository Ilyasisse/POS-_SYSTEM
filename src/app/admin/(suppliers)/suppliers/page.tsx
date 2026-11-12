import Link from "next/link";
import {
  AdminPage,
  Button,
  Card,
  MetricCard,
  DataTableCard,
  StatusBadge,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatMoney as money } from "@/lib/admin/helper/formatMoney";
import { getSupplierPurchaseTodayDateKey } from "@/lib/suppliers/purchase-orders";
import { SupplierEditDialog } from "./SupplierEditDialog";
export default async function SuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const query = (await searchParams) ?? {};
  const today = getSupplierPurchaseTodayDateKey();
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { catalogItems: true } },
      bills: {
        where: { status: { in: ["UNPAID", "PARTIAL"] } },
        select: { totalAmount: true, paidAmount: true, dueDate: true },
      },
      payments: { select: { amount: true, allocations: { select: { amount: true } } } },
      purchaseOrders: { where: { status: "OPEN" }, select: { id: true } },
    },
  });
  const rows = suppliers.map((s) => ({
    ...s,
    outstanding: s.bills.reduce((a, b) => a + Number(b.totalAmount) - Number(b.paidAmount), 0),
    due: s.bills
      .filter((b) => b.dueDate.toISOString().slice(0, 10) <= today)
      .reduce((a, b) => a + Number(b.totalAmount) - Number(b.paidAmount), 0),
    credit: s.payments.reduce(
      (a, p) => a + Number(p.amount) - p.allocations.reduce((x, v) => x + Number(v.amount), 0),
      0,
    ),
  }));
  const needle = (query.q ?? "").trim().toLowerCase();
  const visible = rows.filter(
    (s) =>
      (!needle ||
        [s.name, s.contactName, s.phone, s.email].some((v) => v?.toLowerCase().includes(needle))) &&
      (query.status !== "active" || s.isActive) &&
      (query.status !== "balance" || s.outstanding > 0),
  );
  return (
    <AdminPage
      title="Suppliers"
      description="Contacts, orders and balances in one place."
      action={
        <>
          <Button asChild variant="outline">
            <Link href="/admin/supplier-purchase-orders/new">New purchase order</Link>
          </Button>
          <SupplierEditDialog />
        </>
      }
    >
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Outstanding invoices"
          value={money(rows.reduce((a, s) => a + s.outstanding, 0))}
        />
        <MetricCard label="Due through today" value={money(rows.reduce((a, s) => a + s.due, 0))} />
        <MetricCard
          label="Available credit"
          value={money(rows.reduce((a, s) => a + s.credit, 0))}
        />
        <MetricCard
          label="Open purchase orders"
          value={rows.reduce((a, s) => a + s.purchaseOrders.length, 0)}
        />
      </section>
      <Card className="p-4">
        <form className="flex flex-wrap gap-3" method="get">
          <label className="grid flex-1 gap-1 text-sm">
            Search suppliers
            <Input name="q" defaultValue={query.q} placeholder="Name, contact, phone or email" />
          </label>
          <label className="grid gap-1 text-sm">
            Show
            <select
              name="status"
              defaultValue={query.status ?? ""}
              className="bg-background h-10 rounded-lg border px-3"
            >
              <option value="">All suppliers</option>
              <option value="active">Active</option>
              <option value="balance">Has balance</option>
            </select>
          </label>
          <Button className="self-end">Search</Button>
        </form>
      </Card>
      <DataTableCard>
        <Table data-supplier-cards>
          <thead>
            <tr>
              {["Supplier", "Contact", "Outstanding", "Credit", "Open orders", "Actions"].map(
                (h) => (
                  <TableHead key={h}>{h}</TableHead>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-t">
                <TableCell data-label="Supplier">
                  <Link className="font-semibold hover:underline" href={`/admin/suppliers/${s.id}`}>
                    {s.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {s._count.catalogItems} catalog items
                  </p>
                  <StatusBadge active={s.isActive} />
                </TableCell>
                <TableCell data-label="Contact">
                  <p>{s.contactName ?? "No contact name"}</p>
                  {s.phone ? (
                    <a className="underline" href={`tel:${s.phone}`}>
                      {s.phone}
                    </a>
                  ) : (
                    (s.email ?? "No contact details")
                  )}
                </TableCell>
                <TableCell data-label="Outstanding">
                  <strong>{money(s.outstanding)}</strong>
                  {s.due > 0 ? (
                    <p className="text-destructive text-xs">Due through today {money(s.due)}</p>
                  ) : null}
                </TableCell>
                <TableCell data-label="Credit">{money(s.credit)}</TableCell>
                <TableCell data-label="Open orders">{s.purchaseOrders.length}</TableCell>
                <TableCell data-label="Actions">
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/admin/suppliers/${s.id}`}>View supplier →</Link>
                    </Button>
                    <SupplierEditDialog supplier={s} />
                  </div>
                </TableCell>
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <TableCell colSpan={6}>
                  No suppliers match. Try another search or add a supplier.
                </TableCell>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </DataTableCard>
      <p className="text-muted-foreground text-sm">
        {visible.length} suppliers · USD. Credit belongs to its supplier.
      </p>
    </AdminPage>
  );
}
