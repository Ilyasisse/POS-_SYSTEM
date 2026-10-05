"use client";
import { useEffect, useState } from "react";
import type { CustomerFulfillmentType } from "@/lib/customer/customer-order-fulfillment";
type Props = {
  orderType: CustomerFulfillmentType;
  tableId: string;
  onChange: (type: CustomerFulfillmentType, tableId: string) => void;
};
export default function CustomerFulfillmentSelect({ orderType, tableId, onChange }: Props) {
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/customer/tables", { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load tables. Reopen the cart to retry.");
        return response.json() as Promise<{ tables: { id: string; name: string }[] }>;
      }).then(data => setTables(data.tables))
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, []);
  return <fieldset className="mt-4 space-y-3">
    <legend className="text-sm font-semibold">How would you like your order?</legend>
    <label className="mr-4 inline-flex gap-2"><input type="radio" name="fulfillment" checked={orderType === "TAKEOUT"} onChange={() => onChange("TAKEOUT", "")} />To go</label>
    <label className="inline-flex gap-2"><input type="radio" name="fulfillment" checked={orderType === "DINE_IN"} onChange={() => onChange("DINE_IN", tableId)} />Dine in</label>
    <label className="ml-4 inline-flex gap-2"><input type="radio" name="fulfillment" checked={orderType === "DELIVERY"} onChange={() => onChange("DELIVERY", "")} />Delivery</label>
    {orderType === "DINE_IN" ? <div>
      <label htmlFor="customer-table" className="block text-sm">Your table (required)</label>
      <select id="customer-table" required value={tableId} onChange={event => onChange("DINE_IN", event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3">
        <option value="">Select your table</option>
        {tables.map(table => <option key={table.id} value={table.id}>{table.name}</option>)}
      </select>
      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    </div> : null}
  </fieldset>;
}
