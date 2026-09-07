"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";

type Line = { id: string; payerName: string; payerPhone: string; amount: string };
type RequestLine = { id: string; payerName: string; payerPhone: string; amount: number; paidAmount: number; remainingAmount: number; status: string };
type Receipt = {
  id: string; reference: string | null; direction: "INCOMING" | "OUTGOING" | "UNKNOWN";
  status: "AVAILABLE" | "ASSIGNED" | "OUTGOING" | "NEEDS_REVIEW"; amount: number | null;
  counterpartyLabel: string | null; counterpartyIdentifiers: string[]; transactionAt: string | null;
  providerBalance: number | null; parseError: string | null; assignedByName: string | null;
  rawMessage: string;
  assignment: { paymentRequestId: string; payerName: string; payerPhone: string; expectedAmount: number; table: { id: string; name: string } } | null;
};
type ReceiptTab = "AVAILABLE" | "ASSIGNED" | "OUTGOING" | "NEEDS_REVIEW";

const money = (value: number) => `$${value.toFixed(2)}`;
const tabLabels: Record<ReceiptTab, string> = { AVAILABLE: "Available", ASSIGNED: "Assigned", OUTGOING: "Outgoing", NEEDS_REVIEW: "Needs Review" };

export default function CashierPaymentDialog({ tableId, tableName, amountDue }: { tableId: string; tableName: string; amountDue: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("");
  const [lines, setLines] = useState<Line[]>([{ id: crypto.randomUUID(), payerName: "", payerPhone: "", amount: amountDue.toFixed(2) }]);
  const [payLater, setPayLater] = useState(false);
  const [batchKey, setBatchKey] = useState("");
  const [requests, setRequests] = useState<RequestLine[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [tab, setTab] = useState<ReceiptTab>("AVAILABLE");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyReceiptId, setBusyReceiptId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [reversalReasons, setReversalReasons] = useState<Record<string, string>>({});

  const entered = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0), [lines]);
  const remaining = Math.max(0, amountDue - entered);
  const complete = requests.length > 0 && requests.every((item) => item.status === "MATCHED");
  const selectedRequest = requests.find((item) => item.id === selectedRequestId) ?? null;

  const refresh = useCallback(async () => {
    const calls: Promise<Response>[] = [fetch("/api/cashier/payment-receipts", { cache: "no-store" })];
    if (batchKey) calls.push(fetch(`/api/cashier/payment-requests?batchKey=${encodeURIComponent(batchKey)}`, { cache: "no-store" }));
    const [receiptResponse, requestResponse] = await Promise.all(calls);
    if (receiptResponse.ok) {
      const data = await receiptResponse.json();
      setReceipts(data.receipts ?? []);
      setCanManage(data.canManage === true);
    }
    if (requestResponse?.ok) {
      const data = await requestResponse.json();
      setRequests(data.requests ?? []);
    }
  }, [batchKey]);

  useEffect(() => {
    if (!open || !batchKey) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [batchKey, open, refresh]);

  const visibleReceipts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return receipts.filter((receipt) => receipt.status === tab && (!term || [receipt.reference, receipt.counterpartyLabel, ...receipt.counterpartyIdentifiers, receipt.assignment?.payerName, receipt.assignment?.table.name].some((value) => value?.toLowerCase().includes(term))));
  }, [receipts, search, tab]);

  function updateLine(id: string, field: keyof Omit<Line, "id">, value: string) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  }

  async function startChecks() {
    setError("");
    if (!method) return setError("Select a payment method first.");
    const key = crypto.randomUUID();
    setSubmitting(true);
    try {
      const response = await fetch("/api/cashier/payment-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchKey: key, tableId, method, payLater, lines: lines.map((line) => ({ payerName: line.payerName, payerPhone: line.payerPhone, amount: Number(line.amount) })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start payment checks.");
      setBatchKey(key);
      setRequests((data.requests ?? []).map((item: RequestLine) => ({ ...item, paidAmount: 0, remainingAmount: item.amount })));
      setSelectedRequestId(data.requests?.[0]?.id ?? "");
      toast({ tone: "success", description: "Payment rows are ready. Choose an incoming SAHAL receipt." });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not start payment checks.";
      setError(message);
      toast({ tone: "error", description: message });
    } finally { setSubmitting(false); }
  }

  async function assignReceipt(receipt: Receipt) {
    if (!selectedRequest) return;
    setBusyReceiptId(receipt.id);
    try {
      const response = await fetch(`/api/cashier/payment-receipts/${receipt.id}/assign`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentRequestId: selectedRequest.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not assign this receipt.");
      toast({ tone: "success", description: `${money(receipt.amount ?? 0)} assigned to ${selectedRequest.payerName}.` });
      await refresh();
    } catch (reason) {
      toast({ tone: "error", description: reason instanceof Error ? reason.message : "Could not assign this receipt." });
    } finally { setBusyReceiptId(""); }
  }

  async function reverseReceipt(receipt: Receipt) {
    const reason = reversalReasons[receipt.id]?.trim();
    if (!reason) return void toast({ tone: "warning", description: "Enter a reason before reversing the assignment." });
    setBusyReceiptId(receipt.id);
    try {
      const response = await fetch(`/api/manager/payment-receipts/${receipt.id}/reverse`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reverse this assignment.");
      setReversalReasons((current) => ({ ...current, [receipt.id]: "" }));
      toast({ tone: "success", description: "Receipt assignment reversed and recorded in the audit log." });
      await refresh();
    } catch (reasonValue) {
      toast({ tone: "error", description: reasonValue instanceof Error ? reasonValue.message : "Could not reverse this assignment." });
    } finally { setBusyReceiptId(""); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="min-h-11 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800">Take payment · {money(amountDue)}</Button></DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-[2rem] p-6 sm:p-8">
        <DialogHeader><DialogTitle className="text-3xl">Payment for {tableName}</DialogTitle><DialogDescription>Create a row for each payer, then attach one or more incoming SAHAL receipts.</DialogDescription></DialogHeader>
        {!batchKey ? (
          <div className="space-y-5">
            <label className="block"><span className="mb-2 block text-sm font-semibold">Payment method</span><NativeSelect value={method} onChange={(event) => setMethod(event.target.value)} className="w-full rounded-xl"><option value="">Select payment method</option><option value="GOLIS">GOLIS / SAHAL</option><option value="MYCASH">MYCASH</option><option value="Dahabshiil">Dahabshiil</option><option value="OTHER">OTHER</option></NativeSelect></label>
            <div className="space-y-3">{lines.map((line, index) => <div key={line.id} className="grid gap-2 rounded-2xl border p-3 sm:grid-cols-[1fr_1fr_7rem_auto]"><Input aria-label={`Payer ${index + 1} name`} placeholder="Name" value={line.payerName} onChange={(event) => updateLine(line.id, "payerName", event.target.value)} /><Input aria-label={`Payer ${index + 1} phone`} placeholder="Phone number" value={line.payerPhone} onChange={(event) => updateLine(line.id, "payerPhone", event.target.value)} /><Input aria-label={`Payer ${index + 1} amount`} type="number" min="0.01" step="0.01" value={line.amount} onChange={(event) => updateLine(line.id, "amount", event.target.value)} /><Button type="button" variant="outline" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Remove</Button></div>)}</div>
            <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), payerName: "", payerPhone: "", amount: remaining ? remaining.toFixed(2) : "" }])}>+ Add another payer</Button>
            <div className={`rounded-2xl border p-4 ${Math.abs(remaining) < 0.001 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><div className="flex justify-between"><span>Table balance</span><strong>{money(amountDue)}</strong></div><div className="mt-1 flex justify-between"><span>Entered payments</span><strong>{money(entered)}</strong></div><div className="mt-1 flex justify-between"><span>Remaining</span><strong>{money(remaining)}</strong></div></div>
            {remaining > 0.001 ? <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={payLater} onChange={(event) => setPayLater(event.target.checked)} className="mt-1 size-4" /><span><strong>Pay later</strong><span className="block text-sm text-amber-900">Create a manager alert for the {money(remaining)} balance.</span></span></label> : null}
            {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
            <Button type="button" onClick={startChecks} disabled={submitting || entered <= 0 || entered > amountDue || (remaining > 0.001 && !payLater)} className="w-full rounded-full bg-stone-950 py-4 text-white">{submitting ? "Starting…" : "Start payment check"}</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Incoming SMS messages from 898 appear below automatically. Select the payer first, then assign a receipt.</div>
            <div className="grid gap-3 md:grid-cols-2">{requests.map((request) => <button key={request.id} type="button" onClick={() => setSelectedRequestId(request.id)} className={`rounded-2xl border p-4 text-left ${request.id === selectedRequestId ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "hover:bg-muted/40"}`}><span className="font-semibold">{request.payerName} · {request.payerPhone}</span><span className="mt-2 block text-sm">Paid {money(request.paidAmount)} of {money(request.amount)} · Remaining {money(request.remainingAmount)}</span><span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${request.status === "MATCHED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{request.status.replaceAll("_", " ")}</span></button>)}</div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Payment receipts">{(Object.keys(tabLabels) as ReceiptTab[]).map((item) => <Button key={item} type="button" variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)} role="tab" aria-selected={tab === item}>{tabLabels[item]} ({receipts.filter((receipt) => receipt.status === item).length})</Button>)}</div>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, number, Tix, table, or payer" aria-label="Search receipts" />
            <div className="space-y-3">{visibleReceipts.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No {tabLabels[tab].toLowerCase()} receipts match.</p> : visibleReceipts.map((receipt) => {
              const over = Boolean(selectedRequest && receipt.amount != null && receipt.amount - selectedRequest.remainingAmount > 0.001);
              return <article key={receipt.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{receipt.counterpartyLabel ?? "Unrecognized SAHAL message"}</p><p className="mt-1 text-sm text-muted-foreground">Tix {receipt.reference ?? "not found"} · {receipt.amount == null ? "Amount not found" : money(receipt.amount)}</p><p className="mt-1 text-sm">Numbers: {receipt.counterpartyIdentifiers.join(", ") || "none found"}</p><p className="mt-1 text-sm">{receipt.transactionAt ? new Date(receipt.transactionAt).toLocaleString("en-GB", { timeZone: "Africa/Nairobi" }) : "Time not found"} · Balance {receipt.providerBalance == null ? "not found" : money(receipt.providerBalance)}</p>{receipt.assignment ? <p className="mt-2 rounded-lg bg-muted p-2 text-sm">Assigned to {receipt.assignment.payerName} at {receipt.assignment.table.name} by {receipt.assignedByName ?? "staff"}.</p> : null}{receipt.parseError ? <><p className="mt-2 text-sm font-semibold text-red-700">{receipt.parseError}</p><p className="mt-2 break-words rounded-lg bg-muted p-2 text-xs">{receipt.rawMessage}</p></> : null}</div>{tab === "AVAILABLE" ? <div className="text-right"><Button type="button" disabled={!selectedRequest || selectedRequest.status === "MATCHED" || over || busyReceiptId === receipt.id} onClick={() => void assignReceipt(receipt)}>{busyReceiptId === receipt.id ? "Assigning…" : selectedRequest ? `Assign to ${selectedRequest.payerName}` : "Select a payer"}</Button>{over ? <p className="mt-2 max-w-52 text-xs font-semibold text-red-700">Receipt is larger than this payer&apos;s remaining amount.</p> : null}</div> : null}</div>{tab === "ASSIGNED" && canManage ? <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row"><Input value={reversalReasons[receipt.id] ?? ""} onChange={(event) => setReversalReasons((current) => ({ ...current, [receipt.id]: event.target.value }))} placeholder="Required reversal reason" aria-label={`Reversal reason for ${receipt.reference}`} /><Button type="button" variant="destructive" disabled={busyReceiptId === receipt.id} onClick={() => void reverseReceipt(receipt)}>Reverse assignment</Button></div> : null}</article>;
            })}</div>
            {complete ? <Button type="button" onClick={() => window.location.reload()} className="w-full rounded-full bg-emerald-700 py-4 text-white">Payment confirmed · return to cashier</Button> : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
