"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveDeliveryAction,
  rejectDeliveryAction,
  retryDeliveryAiAction,
} from "../actions";

type Item = {
  id: string;
  aiItemName: string;
  matchedTarget: string;
  quantity: string;
  verifiedQuantity: number | null;
  unitPrice: string;
  totalPrice: string;
  confidenceScore: number | null;
  needsManualReview: boolean;
  notes: string;
};

type Target = { value: string; label: string };

export default function DeliveryVerificationForm({
  deliveryId,
  status,
  items,
  targets,
  aiError,
}: {
  deliveryId: string;
  status: string;
  items: Item[];
  targets: Target[];
  aiError: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  function run(action: (data: FormData) => Promise<void>, data: FormData, success: string) {
    setMessage("");
    startTransition(async () => {
      try {
        await action(data);
        setError(false);
        setMessage(success);
        router.refresh();
      } catch (actionError) {
        setError(true);
        setMessage(actionError instanceof Error ? actionError.message : "Action failed.");
      }
    });
  }

  function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirm("Approve this delivery and update inventory now? This cannot be undone.")) return;
    run(approveDeliveryAction, new FormData(event.currentTarget), "Delivery approved and inventory updated.");
  }

  if (status === "PENDING_AI") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-black text-amber-900">Receipt extraction pending</h2>
        <p className="mt-2 text-sm text-amber-800">{aiError || "The receipt has not been extracted yet."}</p>
        <form className="mt-4" action={(data) => run(retryDeliveryAiAction, data, "Receipt extraction completed.")}>
          <input type="hidden" name="deliveryId" value={deliveryId} />
          <button disabled={pending} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white">{pending ? "Retrying…" : "Retry AI extraction"}</button>
        </form>
        {message ? <p className={`mt-3 text-sm font-semibold ${error ? "text-red-700" : "text-emerald-700"}`}>{message}</p> : null}
      </section>
    );
  }

  if (status !== "PENDING_VERIFICATION") {
    return <p className="rounded-2xl bg-slate-100 p-4 text-sm font-bold text-slate-700">This delivery is {status.toLowerCase().replaceAll("_", " ")} and can no longer update inventory.</p>;
  }

  return (
    <div className="space-y-5">
      <form onSubmit={approve} className="space-y-4">
        <input type="hidden" name="deliveryId" value={deliveryId} />
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50"><tr>{["AI item", "Inventory match", "Verified qty", "Unit price", "Line total", "Confidence", "Notes"].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 text-xs font-black text-slate-600">{label}</th>)}</tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3"><input type="hidden" name="itemId" value={item.id} /><div className="font-bold text-slate-900">{item.aiItemName}</div><div className="text-xs text-slate-500">AI qty: {item.quantity || "--"}</div></td>
                  <td className="px-3 py-3"><select required name={`target-${item.id}`} defaultValue={item.matchedTarget} className="h-10 min-w-56 rounded-lg border border-slate-200 px-2"><option value="">Choose item…</option>{targets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</select></td>
                  <td className="px-3 py-3"><input required min={1} step={1} type="number" name={`quantity-${item.id}`} defaultValue={item.verifiedQuantity ?? item.quantity} className="h-10 w-24 rounded-lg border border-slate-200 px-2" /></td>
                  <td className="px-3 py-3"><input min={0} step="0.01" type="number" name={`unitPrice-${item.id}`} defaultValue={item.unitPrice} className="h-10 w-28 rounded-lg border border-slate-200 px-2" /></td>
                  <td className="px-3 py-3"><input min={0} step="0.01" type="number" name={`totalPrice-${item.id}`} defaultValue={item.totalPrice} className="h-10 w-28 rounded-lg border border-slate-200 px-2" /></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${item.needsManualReview ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{item.confidenceScore == null ? "--" : `${Math.round(item.confidenceScore * 100)}%`}</span></td>
                  <td className="px-3 py-3"><input name={`notes-${item.id}`} defaultValue={item.notes} className="h-10 min-w-40 rounded-lg border border-slate-200 px-2" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <textarea name="notes" rows={3} placeholder="Manager verification notes" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
        <button disabled={pending || !items.length} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-50">{pending ? "Saving…" : "Approve and update inventory"}</button>
      </form>

      <form onSubmit={(event) => { event.preventDefault(); if (confirm("Reject this delivery without updating inventory?")) run(rejectDeliveryAction, new FormData(event.currentTarget), "Delivery rejected."); }} className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <input type="hidden" name="deliveryId" value={deliveryId} />
        <label className="text-sm font-bold text-red-900">Rejection reason</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input name="reason" className="h-10 flex-1 rounded-lg border border-red-200 px-3" placeholder="Optional audit note" /><button disabled={pending} className="rounded-lg bg-red-700 px-4 text-sm font-bold text-white">Reject delivery</button></div>
      </form>
      {message ? <p role="status" className={`rounded-xl p-3 text-sm font-semibold ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p> : null}
    </div>
  );
}
