import Image from "next/image";
import { notFound } from "next/navigation";
import { Table, TableCell, TableHead } from "@/components/ui/table";
import { formatMoney } from "@/lib/admin/helper/formatMoney";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export default async function PrintableSupplierPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.SUPPLIER_MANAGE);
  const { id } = await params;
  const order = await prisma.supplierPurchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { fullName: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  return (
    <main className="min-h-dvh bg-muted/30 p-4 text-foreground print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="mx-auto max-w-4xl rounded-2xl border bg-background p-6 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b pb-6">
          <div className="flex items-center gap-4">
            <Image
              src="/newer_logo.png"
              alt="Mash Allah Cafe"
              width={72}
              height={72}
              className="size-16 object-contain"
              priority
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Mash Allah Cafe
              </p>
              <h1 className="text-3xl font-semibold">Purchase order</h1>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">PO #{order.orderNumber}</div>
            <div className="text-sm text-muted-foreground">{order.status}</div>
          </div>
        </header>

        <section className="grid gap-6 border-b py-6 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Supplier
            </h2>
            <p className="mt-1 text-xl font-semibold">{order.supplier.name}</p>
            <p className="text-sm">{order.supplier.contactName || ""}</p>
            <p className="text-sm">{order.supplier.phone || order.supplier.email || ""}</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{DATE_FORMATTER.format(order.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expected delivery</dt>
              <dd className="font-medium">{DATE_FORMATTER.format(order.expectedDeliveryDate)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Prepared by</dt>
              <dd className="font-medium">{order.createdBy.fullName}</dd>
            </div>
          </dl>
        </section>

        <Table className="my-6">
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
                <TableCell className="font-medium">{item.itemName}</TableCell>
                <TableCell>{item.itemUnit}</TableCell>
                <TableCell>{item.quantity.toString()}</TableCell>
                <TableCell>{formatMoney(Number(item.unitPrice))}</TableCell>
                <TableCell className="font-semibold">
                  {formatMoney(Number(item.lineTotal))}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="flex justify-end border-t pt-5">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Order total</div>
            <div className="text-3xl font-semibold">
              {formatMoney(Number(order.totalAmount))}
            </div>
          </div>
        </div>

        {order.notes ? (
          <section className="mt-6 rounded-xl border p-4">
            <h2 className="font-semibold">Order notes</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm">{order.notes}</p>
          </section>
        ) : null}
      </article>
    </main>
  );
}
