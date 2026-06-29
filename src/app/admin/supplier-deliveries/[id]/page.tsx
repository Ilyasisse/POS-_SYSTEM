import Image from "next/image";
import { notFound } from "next/navigation";
import { AdminCard, AdminPageFrame, ToneBadge } from "@/components/admin/AdminUi";
import { prisma } from "@/lib/prisma";
import { createSupplierReceiptUrl } from "@/lib/suppliers/storage";
import DeliveryVerificationForm from "./DeliveryVerificationForm";

function money(value: { toString(): string } | null) {
  return value ? `$${Number(value.toString()).toFixed(2)}` : "--";
}

export default async function SupplierDeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [delivery, products, supplies] = await Promise.all([
    prisma.supplierDelivery.findUnique({
      where: { id },
      include: { supplier: true, items: { orderBy: { createdAt: "asc" } }, verifiedBy: true, rejectedBy: true, bill: true },
    }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.inventorySupply.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }),
  ]);
  if (!delivery) notFound();
  const receiptUrl = await createSupplierReceiptUrl(delivery.receiptObjectPath);
  const targets = [
    ...products.map((row) => ({ value: `product:${row.id}`, label: `Product · ${row.name}` })),
    ...supplies.map((row) => ({ value: `supply:${row.id}`, label: `Supply · ${row.name} (${row.unit})` })),
  ];

  return (
    <AdminPageFrame title={`${delivery.supplier.name} delivery`} description={`Submitted ${delivery.submittedAt.toLocaleString()} by ${delivery.uploadedByEmail}`}>
      <div className="flex flex-wrap gap-2"><ToneBadge tone={delivery.status === "VERIFIED" ? "green" : delivery.status === "REJECTED" ? "red" : "amber"}>{delivery.status.replaceAll("_", " ")}</ToneBadge>{delivery.bill ? <ToneBadge tone={delivery.bill.status === "PAID" ? "green" : "amber"}>{delivery.bill.status}</ToneBadge> : null}</div>
      <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.5fr)]">
        <AdminCard className="p-4">
          <h2 className="mb-3 font-black">Receipt</h2>
          <a href={receiptUrl} target="_blank" rel="noreferrer" className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100"><Image src={receiptUrl} alt="Supplier receipt" fill sizes="(min-width: 1280px) 32vw, 100vw" unoptimized className="object-contain" /></a>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-500">Invoice</dt><dd className="font-bold">{delivery.invoiceNumber || "--"}</dd></div>
            <div><dt className="text-slate-500">Total</dt><dd className="font-bold">{money(delivery.totalAmount)}</dd></div>
            <div><dt className="text-slate-500">Receipt date</dt><dd className="font-bold">{delivery.receiptDate?.toLocaleDateString() || "--"}</dd></div>
            <div><dt className="text-slate-500">Inventory updated</dt><dd className="font-bold">{delivery.inventoryUpdatedAt ? "Yes" : "No"}</dd></div>
          </dl>
          {delivery.notes ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{delivery.notes}</p> : null}
        </AdminCard>
        <AdminCard className="p-4"><h2 className="mb-4 font-black">Verification</h2><DeliveryVerificationForm deliveryId={delivery.id} status={delivery.status} extractionError={delivery.aiError} extractedText={delivery.extractedText || ""} reviewedText={delivery.reviewedText || ""} invoiceNumber={delivery.invoiceNumber || ""} receiptDate={delivery.receiptDate?.toISOString().slice(0, 10) || ""} targets={targets} items={delivery.items.map((item) => ({ id: item.id, description: item.aiItemName, matchedTarget: item.productId ? `product:${item.productId}` : item.inventorySupplyId ? `supply:${item.inventorySupplyId}` : "", quantity: item.quantity?.toString() || "", verifiedQuantity: item.verifiedQuantity, unitPrice: item.unitPrice?.toString() || "", totalPrice: item.totalPrice?.toString() || "" }))} /></AdminCard>
      </div>
      {delivery.status === "VERIFIED" && delivery.items.length ? (
        <AdminCard className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-black">Accepted invoice items</h2></div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3">Inventory match</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Unit price</th><th className="px-4 py-3">Line total</th></tr></thead>
              <tbody>{delivery.items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{item.aiItemName}</td><td className="px-4 py-3">{item.matchedItemName || "--"}</td><td className="px-4 py-3">{item.verifiedQuantity ?? item.quantity?.toString() ?? "--"}</td><td className="px-4 py-3">{money(item.unitPrice)}</td><td className="px-4 py-3 font-bold">{money(item.totalPrice)}</td></tr>)}</tbody>
            </table>
          </div>
        </AdminCard>
      ) : null}
      <AdminCard className="p-4">
        {delivery.reviewedText ? (
          <div>
            <h2 className="font-black">Reviewed invoice text</h2>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800">{delivery.reviewedText}</pre>
          </div>
        ) : null}
        <details className={delivery.reviewedText ? "mt-4" : ""} open={!delivery.reviewedText}>
          <summary className="cursor-pointer font-black">Original extracted text</summary>
          {delivery.extractedText ? (
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{delivery.extractedText}</pre>
          ) : (
            <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{delivery.aiError || "No invoice transcription is available."}</p>
          )}
        </details>
      </AdminCard>
    </AdminPageFrame>
  );
}
