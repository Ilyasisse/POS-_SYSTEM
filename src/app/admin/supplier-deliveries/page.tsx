import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import type {
  Prisma,
  SupplierDeliveryStatus,
  SupplierPaymentStatus,
} from "@prisma/client";
import {
  AdminPage,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  ToneBadge,
} from "@/components/admin/shared";
import { prisma } from "@/lib/prisma";

const deliveryStatuses = [
  "PENDING_EXTRACTION",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "REJECTED",
] as const;
const paymentStatuses = ["UNPAID", "PARTIAL", "PAID"] as const;

function dateParam(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function SupplierDeliveriesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const params = (await searchParams) || {};
  const status = deliveryStatuses.includes(
    params.status as SupplierDeliveryStatus,
  )
    ? (params.status as SupplierDeliveryStatus)
    : undefined;
  const paymentStatus = paymentStatuses.includes(
    params.paymentStatus as SupplierPaymentStatus,
  )
    ? (params.paymentStatus as SupplierPaymentStatus)
    : undefined;
  const where: Prisma.SupplierDeliveryWhereInput = {
    supplierId: params.supplier || undefined,
    status,
    bill: paymentStatus ? { status: paymentStatus } : undefined,
    submittedAt:
      dateParam(params.from) || dateParam(params.to, true)
        ? {
            gte: dateParam(params.from),
            lte: dateParam(params.to, true),
          }
        : undefined,
  };
  const [deliveries, suppliers] = await Promise.all([
    prisma.supplierDelivery.findMany({
      where,
      include: { supplier: true, bill: true },
      orderBy: { submittedAt: "desc" },
      take: 200,
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <AdminPage
      title="Supplier deliveries"
      description="Review receipt submissions before any inventory is updated."
    >
      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <NativeSelect
          name="supplier"
          defaultValue={params.supplier || ""}
          className="h-10 rounded-lg border border-slate-200 px-2"
        >
          <option value="">All suppliers</option>
          {suppliers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          name="status"
          defaultValue={status || ""}
          className="h-10 rounded-lg border border-slate-200 px-2"
        >
          <option value="">All delivery statuses</option>
          {deliveryStatuses.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          name="paymentStatus"
          defaultValue={paymentStatus || ""}
          className="h-10 rounded-lg border border-slate-200 px-2"
        >
          <option value="">All payment statuses</option>
          {paymentStatuses.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </NativeSelect>
        <Input
          aria-label="Submitted from date"
          type="date"
          name="from"
          defaultValue={params.from || ""}
          className="h-10 rounded-lg border border-slate-200 px-2"
        />
        <div className="flex gap-2">
          <Input
            aria-label="Submitted through date"
            type="date"
            name="to"
            defaultValue={params.to || ""}
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-2"
          />
          <Button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 text-sm font-bold text-white"
          >
            Filter
          </Button>
        </div>
      </form>
      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Supplier</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Action</TableHead>
            </tr>
          </thead>
          <tbody>
            {deliveries.length ? (
              deliveries.map((delivery) => (
                <tr key={delivery.id} className="border-t border-slate-100">
                  <TableCell>
                    <span className="font-bold text-slate-900">
                      {delivery.supplier.name}
                    </span>
                    <div className="text-xs">
                      {delivery.invoiceNumber || "No invoice number"}
                    </div>
                  </TableCell>
                  <TableCell>{delivery.submittedAt.toLocaleString()}</TableCell>
                  <TableCell>
                    {delivery.totalAmount
                      ? `$${Number(delivery.totalAmount).toFixed(2)}`
                      : "--"}
                  </TableCell>
                  <TableCell>
                    <ToneBadge
                      tone={
                        delivery.status === "VERIFIED"
                          ? "green"
                          : delivery.status === "REJECTED"
                            ? "red"
                            : "amber"
                      }
                    >
                      {delivery.status.replaceAll("_", " ")}
                    </ToneBadge>
                  </TableCell>
                  <TableCell>
                    {delivery.bill ? (
                      <ToneBadge
                        tone={
                          delivery.bill.status === "PAID" ? "green" : "amber"
                        }
                      >
                        {delivery.bill.status}
                      </ToneBadge>
                    ) : (
                      "--"
                    )}
                  </TableCell>
                  <TableCell>
                    {delivery.inventoryUpdatedAt ? "Updated" : "Not updated"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/supplier-deliveries/${delivery.id}`}
                      className="font-bold text-blue-600"
                    >
                      Review
                    </Link>
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={7}>
                  No supplier deliveries match these filters.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
