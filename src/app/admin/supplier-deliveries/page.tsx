import Link from "next/link";
import type { Prisma, SupplierDeliveryStatus, SupplierPaymentStatus } from "@prisma/client";
import { AdminPageFrame, AdminTable, AdminTableShell, AdminTd, AdminTh, ToneBadge } from "@/components/admin/AdminUi";
import { prisma } from "@/lib/prisma";

const deliveryStatuses = ["PENDING_AI", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"] as const;
const paymentStatuses = ["UNPAID", "PARTIAL", "PAID"] as const;

function dateParam(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function SupplierDeliveriesPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = (await searchParams) || {};
  const status = deliveryStatuses.includes(params.status as SupplierDeliveryStatus) ? params.status as SupplierDeliveryStatus : undefined;
  const paymentStatus = paymentStatuses.includes(params.paymentStatus as SupplierPaymentStatus) ? params.paymentStatus as SupplierPaymentStatus : undefined;
  const where: Prisma.SupplierDeliveryWhereInput = {
    supplierId: params.supplier || undefined,
    status,
    bill: paymentStatus ? { status: paymentStatus } : undefined,
    submittedAt: dateParam(params.from) || dateParam(params.to, true) ? {
      gte: dateParam(params.from),
      lte: dateParam(params.to, true),
    } : undefined,
  };
  const [deliveries, suppliers] = await Promise.all([
    prisma.supplierDelivery.findMany({ where, include: { supplier: true, bill: true }, orderBy: { submittedAt: "desc" }, take: 200 }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <AdminPageFrame title="Supplier deliveries" description="Review receipt submissions before any inventory is updated.">
      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <select name="supplier" defaultValue={params.supplier || ""} className="h-10 rounded-lg border border-slate-200 px-2"><option value="">All suppliers</option>{suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <select name="status" defaultValue={status || ""} className="h-10 rounded-lg border border-slate-200 px-2"><option value="">All delivery statuses</option>{deliveryStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
        <select name="paymentStatus" defaultValue={paymentStatus || ""} className="h-10 rounded-lg border border-slate-200 px-2"><option value="">All payment statuses</option>{paymentStatuses.map((value) => <option key={value}>{value}</option>)}</select>
        <input type="date" name="from" defaultValue={params.from || ""} className="h-10 rounded-lg border border-slate-200 px-2" />
        <div className="flex gap-2"><input type="date" name="to" defaultValue={params.to || ""} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-2" /><button className="rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">Filter</button></div>
      </form>
      <AdminTableShell><AdminTable><thead><tr><AdminTh>Supplier</AdminTh><AdminTh>Submitted</AdminTh><AdminTh>Total</AdminTh><AdminTh>Delivery</AdminTh><AdminTh>Payment</AdminTh><AdminTh>Inventory</AdminTh><AdminTh>Action</AdminTh></tr></thead><tbody>
        {deliveries.length ? deliveries.map((delivery) => <tr key={delivery.id} className="border-t border-slate-100"><AdminTd><span className="font-bold text-slate-900">{delivery.supplier.name}</span><div className="text-xs">{delivery.invoiceNumber || "No invoice number"}</div></AdminTd><AdminTd>{delivery.submittedAt.toLocaleString()}</AdminTd><AdminTd>{delivery.totalAmount ? `$${Number(delivery.totalAmount).toFixed(2)}` : "--"}</AdminTd><AdminTd><ToneBadge tone={delivery.status === "VERIFIED" ? "green" : delivery.status === "REJECTED" ? "red" : "amber"}>{delivery.status.replaceAll("_", " ")}</ToneBadge></AdminTd><AdminTd>{delivery.bill ? <ToneBadge tone={delivery.bill.status === "PAID" ? "green" : "amber"}>{delivery.bill.status}</ToneBadge> : "--"}</AdminTd><AdminTd>{delivery.inventoryUpdatedAt ? "Updated" : "Not updated"}</AdminTd><AdminTd><Link href={`/admin/supplier-deliveries/${delivery.id}`} className="font-bold text-blue-600">Review</Link></AdminTd></tr>) : <tr><AdminTd colSpan={7}>No supplier deliveries match these filters.</AdminTd></tr>}
      </tbody></AdminTable></AdminTableShell>
    </AdminPageFrame>
  );
}
