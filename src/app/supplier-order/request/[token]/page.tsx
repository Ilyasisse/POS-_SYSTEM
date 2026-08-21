import type { Metadata } from "next";
import { Clock3, ShoppingBasket } from "lucide-react";
import { getSupplierOrderRequest } from "@/lib/supplier-orders/requests";
import SupplierOrderRequestForm from "./SupplierOrderRequestForm";

export const metadata: Metadata = {
  title: "Supplier order request",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function SupplierOrderRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await getSupplierOrderRequest(token);
  if (!request) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 p-5">
        <section className="max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <ShoppingBasket className="mx-auto size-10 text-slate-400" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">Link unavailable</h1>
          <p className="mt-2 text-slate-600">This temporary order link is invalid or has expired.</p>
        </section>
      </main>
    );
  }
  const deadline = new Intl.DateTimeFormat("en-US", {
    timeZone: request.timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(request.deadline);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Mash Allah Cafe</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Hello, {request.employeeName}</h1>
          <p className="mt-2 text-slate-600">
            Select what is needed from <strong>{request.supplierName}</strong>. Prices are handled by management.
          </p>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-950">
            <Clock3 className="mt-0.5 size-4 shrink-0" />
            <span>Changes close {deadline} ({request.timeZone}).</span>
          </div>
        </header>
        <SupplierOrderRequestForm
          token={token}
          items={request.items}
          initialSelected={request.selected}
          initialStatus={request.status}
          editable={request.editable}
        />
      </div>
    </main>
  );
}
