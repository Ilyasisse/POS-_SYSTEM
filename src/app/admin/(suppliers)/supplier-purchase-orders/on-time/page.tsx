import Link from "next/link";
import {
  AdminPage,
  Button,
  DataTableCard,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import {
  dateInCafe,
  summarizeSupplierDeliveries,
} from "@/lib/suppliers/on-time-scorecard";

export const dynamic = "force-dynamic";

export default async function SupplierOnTimePage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params?.days))
    ? Number(params?.days)
    : 30;
  const today = dateInCafe(new Date());
  const end = new Date(`${today}T00:00:00.000Z`);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  const orders = await prisma.supplierPurchaseOrder.findMany({
    where: {
      status: { not: "CANCELLED" },
      expectedDeliveryDate: { gte: start, lte: end },
    },
    select: {
      supplierId: true,
      supplier: { select: { name: true } },
      expectedDeliveryDate: true,
      receiving: { select: { receivedAt: true } },
    },
  });
  const scorecard = summarizeSupplierDeliveries(
    orders.map((order) => ({
      supplierId: order.supplierId,
      supplierName: order.supplier.name,
      expectedDeliveryDate: order.expectedDeliveryDate,
      receivedAt: order.receiving?.receivedAt ?? null,
    })),
  );

  return (
    <AdminPage
      title="Supplier on-time delivery"
      description="Compare recorded receiving dates with purchase-order expectations."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/supplier-purchase-orders">Purchase orders</Link>
        </Button>
      }
    >
      <nav className="flex flex-wrap gap-2" aria-label="Scorecard time period">
        {[7, 30, 90].map((period) => (
          <Button
            key={period}
            asChild
            variant={days === period ? "default" : "outline"}
          >
            <Link
              href={`/admin/supplier-purchase-orders/on-time?days=${period}`}
            >
              Last {period} days
            </Link>
          </Button>
        ))}
      </nav>
      <p className="text-sm text-muted-foreground">
        Expected dates {start.toISOString().slice(0, 10)} through {today}, using
        the café calendar for arrivals. Cancelled orders are excluded. Missing
        receiving records are shown separately, not counted as on time or late.
        Completion of an invoice is not proof of delivery.
      </p>
      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Supplier</TableHead>
              <TableHead>On time</TableHead>
              <TableHead>Late</TableHead>
              <TableHead>No receiving record</TableHead>
              <TableHead>On-time rate</TableHead>
            </tr>
          </thead>
          <tbody>
            {scorecard.length ? (
              scorecard.map((row) => (
                <tr key={row.supplierId} className="border-t">
                  <TableCell className="font-semibold">{row.name}</TableCell>
                  <TableCell>{row.onTime}</TableCell>
                  <TableCell>{row.late}</TableCell>
                  <TableCell>{row.notRecorded}</TableCell>
                  <TableCell>
                    {row.onTimePercent === null
                      ? "No recorded deliveries"
                      : `${row.onTimePercent}% of ${row.recorded}`}
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={5}>
                  No purchase orders expected in this period.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
