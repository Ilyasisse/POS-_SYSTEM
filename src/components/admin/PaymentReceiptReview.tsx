"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
type Receipt = { id: string; status: string; direction: string; rawMessage: string; parseError: string | null; reference: string | null; amount: number | null; counterpartyLabel: string | null; counterpartyIdentifiers: string[]; transactionAt: string | null; providerBalance: number | null };
export default function PaymentReceiptReview() {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/cashier/payment-receipts", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load receipt review inbox.");
      const data = await response.json() as { receipts: Receipt[] };
      setReceipts(data.receipts);
    } catch (cause) { toast({ tone: "error", description: cause instanceof Error ? cause.message : "Could not load receipts." }); }
  }, [toast]);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initial);
  }, [refresh]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch(`/api/manager/payment-receipts/${encodeURIComponent(selected.id)}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: form.get("direction"), providerReference: form.get("reference"), amount: Number(form.get("amount")),
          counterpartyLabel: form.get("payer"), counterpartyIdentifiers: String(form.get("phone") ?? "").split(/[\s,]+/),
          transactionAt: form.get("time"), providerBalance: Number(form.get("balance")), reason: form.get("reason"),
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save receipt review.");
      toast({ tone: "success", description: "Receipt reviewed. Assign it to the verified customer checkout above." });
      setSelected(null);
      await refresh();
    } catch (cause) { toast({ tone: "error", description: cause instanceof Error ? cause.message : "Could not save review." }); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Payment message inbox</h2><Button variant="outline" onClick={() => void refresh()}>Refresh</Button></div>
    <p className="text-sm text-muted-foreground">Malformed messages require correction here. Incoming unassigned payments, phone/amount/time exceptions remain available in the customer review list above. Outgoing payments cannot fund an order.</p>
    {receipts.filter(receipt => receipt.status === "NEEDS_REVIEW").length === 0 ? <p>No malformed messages waiting for review.</p> : null}
    {receipts.map(receipt => <article key={receipt.id} className="rounded-xl border p-4">
      <p className="font-semibold">{receipt.reference ?? "Unparsed message"} · {receipt.direction} · {receipt.status}</p>
      {receipt.parseError ? <p className="text-sm text-rose-700">{receipt.parseError}</p> : null}
      <p className="mt-2 break-words text-sm">{receipt.rawMessage}</p>
      {receipt.status === "NEEDS_REVIEW" ? <Button className="mt-3" variant="outline" onClick={() => setSelected(receipt)}>Review message</Button> : null}
    </article>)}
    {selected ? <form key={selected.id} onSubmit={event => void save(event)} className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">Correct message from its original SMS</h3>
      <p className="break-words text-sm">{selected.rawMessage}</p>
      <label className="block">Direction<select name="direction" required className="ml-2 rounded border bg-background p-2"><option value="INCOMING">Incoming</option><option value="OUTGOING">Outgoing</option></select></label>
      {[["reference", "Tix reference", "text"], ["amount", "Amount (USD)", "number"], ["payer", "Complete payer label", "text"], ["phone", "Payer phone / identifiers", "text"], ["time", "Transaction time with timezone (ISO, e.g. +03:00)", "text"], ["balance", "Provider balance", "number"], ["reason", "Review reason", "text"]].map(([name, label, type]) => <label key={name} className="block text-sm">{label}<input name={name} type={type} required step={type === "number" ? "0.01" : undefined} className="mt-1 block w-full rounded border bg-background p-2" /></label>)}
      <Button type="submit" disabled={busy}>Save audited correction</Button><Button className="ml-2" type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
    </form> : null}
  </section>;
}
