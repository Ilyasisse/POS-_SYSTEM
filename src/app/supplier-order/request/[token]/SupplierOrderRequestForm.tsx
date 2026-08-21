"use client";

import { useRef, useState } from "react";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id: string; name: string; unit: string };

export default function SupplierOrderRequestForm({
  token,
  items,
  initialSelected,
  initialStatus,
  editable,
}: {
  token: string;
  items: Item[];
  initialSelected: Record<string, string>;
  initialStatus: "PENDING" | "RESPONDED" | "NO_ORDER";
  editable: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, string>>(initialSelected);
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const latestRequestId = useRef(0);

  async function submit(noOrder: boolean) {
    const requestId = ++latestRequestId.current;
    setPending(true);
    setMessage(null);
    const chosen: { catalogItemId: string; quantity: string }[] = [];
    for (const [catalogItemId, quantity] of Object.entries(selected)) {
      if (Number(quantity) > 0) chosen.push({ catalogItemId, quantity });
    }
    try {
      const response = await fetch(
        `/api/supplier-order-requests/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noOrder, items: noOrder ? [] : chosen }),
        },
      );
      const payload = (await response.json()) as { error?: string; status?: typeof status };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save your order.");
      if (requestId !== latestRequestId.current) return;
      setStatus(noOrder ? "NO_ORDER" : "RESPONDED");
      if (noOrder) setSelected({});
      setMessage(
        noOrder
          ? "Confirmed: no order is needed. You can change this before the deadline."
          : "Your latest item quantities have been saved.",
      );
    } catch (error) {
      if (requestId === latestRequestId.current) {
        setMessage(error instanceof Error ? error.message : "Unable to save your order.");
      }
    } finally {
      if (requestId === latestRequestId.current) setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {status !== "PENDING" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm font-semibold">
            {status === "NO_ORDER"
              ? "You selected no order needed."
              : "Your order choices are confirmed."}
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3">
          <h2 className="font-bold text-slate-950">Items needed</h2>
          <p className="text-sm text-slate-600">Enter a quantity only for items you need.</p>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <label key={item.id} className="grid grid-cols-[1fr_7rem] items-center gap-4 p-4">
              <span>
                <span className="block font-semibold text-slate-950">{item.name}</span>
                <span className="block text-sm text-slate-500">Unit: {item.unit}</span>
              </span>
              <Input
                aria-label={`${item.name} quantity`}
                type="number"
                min="0"
                max="999999999.999"
                step="0.001"
                inputMode="decimal"
                placeholder="0"
                value={selected[item.id] ?? ""}
                disabled={!editable || pending}
                onChange={(event) =>
                  setSelected((current) => ({ ...current, [item.id]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border bg-white p-3 text-sm font-medium text-slate-700" role="status">
          {message}
        </p>
      ) : null}

      {editable ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            disabled={pending}
            onClick={() => submit(false)}
            className="h-12"
          >
            <PackageCheck /> Confirm selected items
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={pending}
            onClick={() => submit(true)}
            className="h-12"
          >
            No order needed
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-100 p-4 text-center font-semibold text-slate-700">
          This order window is closed. Your recorded response can no longer be changed.
        </p>
      )}
    </div>
  );
}
