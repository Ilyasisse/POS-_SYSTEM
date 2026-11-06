"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { receiptAssignmentIssue } from "@/lib/cashier/cashier-presentation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";
import { MAX_EQUAL_SPLIT_PEOPLE, splitBillEqually } from "@/lib/payments/equal-bill-split";

type Line = {
  id: string;
  payerName: string;
  payerPhone: string;
  amount: string;
};
type RequestLine = {
  id: string;
  payerName: string;
  payerPhone: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
};
type Receipt = {
  id: string;
  reference: string | null;
  direction: "INCOMING" | "OUTGOING" | "UNKNOWN";
  status: "AVAILABLE" | "ASSIGNED" | "OUTGOING" | "NEEDS_REVIEW";
  amount: number | null;
  counterpartyLabel: string | null;
  counterpartyIdentifiers: string[];
  transactionAt: string | null;
  providerBalance: number | null;
  parseError: string | null;
  assignedByName: string | null;
  rawMessage: string;
  customerCheckout: {
    id: string;
    customerName: string;
    payerPhone: string;
    amount: number;
  } | null;
  assignment: {
    paymentRequestId: string;
    payerName: string;
    payerPhone: string;
    expectedAmount: number;
    table: { id: string; name: string };
  } | null;
};
type ReceiptTab = "AVAILABLE" | "ASSIGNED" | "OUTGOING" | "NEEDS_REVIEW";

const money = (value: number) => `$${value.toFixed(2)}`;
const tabLabels: Record<ReceiptTab, string> = {
  AVAILABLE: "Available",
  ASSIGNED: "Assigned",
  OUTGOING: "Outgoing",
  NEEDS_REVIEW: "Needs Review",
};

export default function CashierPaymentDialog({
  tableId,
  tableName,
  amountDue,
  showEqualSplit,
}: {
  tableId: string;
  tableName: string;
  amountDue: number;
  showEqualSplit: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const mutationRef = useRef(false);
  const refreshVersion = useRef(0);
  const [viewPayers, setViewPayers] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("");
  const [equalSplitCount, setEqualSplitCount] = useState("2");
  const [lines, setLines] = useState<Line[]>([
    {
      id: crypto.randomUUID(),
      payerName: "",
      payerPhone: "",
      amount: amountDue.toFixed(2),
    },
  ]);
  const [payLater, setPayLater] = useState(false);
  const [batchKey, setBatchKey] = useState("");
  const [requests, setRequests] = useState<RequestLine[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [tab, setTab] = useState<ReceiptTab>("AVAILABLE");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyReceiptId, setBusyReceiptId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [reversalReasons, setReversalReasons] = useState<Record<string, string>>({});

  const entered = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines],
  );
  const remaining = Math.max(0, amountDue - entered);
  const complete = requests.length > 0 && requests.every((item) => item.status === "MATCHED");
  const selectedRequest = requests.find((item) => item.id === selectedRequestId) ?? null;

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const [receiptResponse, requestResponse] = await Promise.all([
        fetch("/api/cashier/payment-receipts", { cache: "no-store" }),
        fetch(`/api/cashier/payment-requests?batchKey=${encodeURIComponent(batchKey)}`, {
          cache: "no-store",
        }),
      ]);
      if (!receiptResponse.ok || !requestResponse.ok)
        throw new Error("Could not refresh payments. Check your connection and retry.");
      const [receiptData, requestData] = await Promise.all([
        receiptResponse.json(),
        requestResponse.json(),
      ]);
      if (version !== refreshVersion.current) return;
      setReceipts(receiptData.receipts ?? []);
      setCanManage(receiptData.canManage === true);
      setRequests(requestData.requests ?? []);
      setLoaded(true);
      setSyncError("");
    } catch (reason) {
      if (version === refreshVersion.current)
        setSyncError(reason instanceof Error ? reason.message : "Could not refresh payments.");
    }
  }, [batchKey]);

  const invalidateRefresh = useCallback(() => {
    ++refreshVersion.current;
  }, []);
  useEffect(() => {
    if (!open || !batchKey) return;
    const poll = () => {
      if (document.visibilityState === "visible" && !mutationRef.current) void refresh();
    };
    const initial = window.setTimeout(poll, 0);
    const timer = window.setInterval(poll, 2500);
    return () => {
      invalidateRefresh();
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [batchKey, open, refresh, invalidateRefresh]);

  const visibleReceipts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return receipts.filter(
      (receipt) =>
        receipt.status === tab &&
        (!term ||
          [
            receipt.reference,
            receipt.counterpartyLabel,
            ...receipt.counterpartyIdentifiers,
            receipt.assignment?.payerName,
            receipt.assignment?.table.name,
          ].some((value) => value?.toLowerCase().includes(term))),
    );
  }, [receipts, search, tab]);

  function updateLine(id: string, field: keyof Omit<Line, "id">, value: string) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  function applyEqualSplit() {
    if (!showEqualSplit) return;
    try {
      const amounts = splitBillEqually(amountDue, Number(equalSplitCount));
      setLines(
        amounts.map((amount) => ({
          id: crypto.randomUUID(),
          payerName: "",
          payerPhone: "",
          amount: amount.toFixed(2),
        })),
      );
      setPayLater(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not split the bill.");
    }
  }

  async function startChecks() {
    if (mutationRef.current) return;
    setAttempted(true);
    setError("");
    if (
      lines.some(
        (line) =>
          !line.payerName.trim() ||
          !line.payerPhone.trim() ||
          !Number.isFinite(Number(line.amount)) ||
          Number(line.amount) <= 0,
      )
    ) {
      setError("Check the highlighted payer fields.");
      return;
    }
    if (!method) return setError("Select a payment method first.");
    const key = crypto.randomUUID();
    mutationRef.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/cashier/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchKey: key,
          tableId,
          method,
          payLater,
          lines: lines.map((line) => ({
            payerName: line.payerName,
            payerPhone: line.payerPhone,
            amount: Number(line.amount),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start payment checks.");
      setBatchKey(key);
      setViewPayers(false);
      setRequests(
        (data.requests ?? []).map((item: RequestLine) => ({
          ...item,
          paidAmount: 0,
          remainingAmount: item.amount,
        })),
      );
      setSelectedRequestId(data.requests?.[0]?.id ?? "");
      toast({
        tone: "success",
        description: "Payment rows are ready. Choose an incoming SAHAL receipt.",
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not start payment checks.";
      setError(message);
      toast({ tone: "error", description: message });
    } finally {
      mutationRef.current = false;
      setSubmitting(false);
    }
  }

  async function assignReceipt(receipt: Receipt) {
    if (
      mutationRef.current ||
      !loaded ||
      syncError ||
      receiptAssignmentIssue(selectedRequest, receipt)
    )
      return;
    if (!selectedRequest) return;
    mutationRef.current = true;
    ++refreshVersion.current;
    setLoaded(false);
    setBusyReceiptId(receipt.id);
    try {
      const response = await fetch(`/api/cashier/payment-receipts/${receipt.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRequestId: selectedRequest.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not assign this receipt.");
      toast({
        tone: "success",
        description: `${money(receipt.amount ?? 0)} assigned to ${selectedRequest.payerName}.`,
      });
      await refresh();
    } catch (reason) {
      toast({
        tone: "error",
        description: reason instanceof Error ? reason.message : "Could not assign this receipt.",
      });
    } finally {
      mutationRef.current = false;
      setBusyReceiptId("");
    }
  }

  async function reverseReceipt(receipt: Receipt) {
    if (mutationRef.current) return;
    const reason = reversalReasons[receipt.id]?.trim();
    if (!reason)
      return void toast({
        tone: "warning",
        description: "Enter a reason before reversing the assignment.",
      });
    mutationRef.current = true;
    ++refreshVersion.current;
    setLoaded(false);
    setBusyReceiptId(receipt.id);
    try {
      const response = await fetch(`/api/manager/payment-receipts/${receipt.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reverse this assignment.");
      setReversalReasons((current) => ({ ...current, [receipt.id]: "" }));
      toast({
        tone: "success",
        description: "Receipt assignment reversed and recorded in the audit log.",
      });
      await refresh();
    } catch (reasonValue) {
      toast({
        tone: "error",
        description:
          reasonValue instanceof Error ? reasonValue.message : "Could not reverse this assignment.",
      });
    } finally {
      mutationRef.current = false;
      setBusyReceiptId("");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (mutationRef.current) return;
        if (value && batchKey) setLoaded(false);
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-11 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
          Take payment · {money(amountDue)}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-dvh max-h-dvh max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90dvh] sm:max-h-[90dvh] sm:max-w-4xl sm:rounded-2xl [&>button]:size-11">
        <DialogHeader className="bg-card shrink-0 border-b p-4 pr-14 sm:p-6 sm:pr-16">
          <DialogTitle className="text-xl font-bold">Payment · {tableName}</DialogTitle>
          <DialogDescription>
            Set up payers, then match incoming receipts. Closing this dialog keeps your current
            setup until you leave this page.
          </DialogDescription>
        </DialogHeader>
        <div
          className="bg-card flex shrink-0 flex-wrap items-center gap-2 border-b p-3"
          aria-label="Payment progress"
        >
          <Button
            className="min-h-11"
            variant={!batchKey || viewPayers ? "default" : "outline"}
            onClick={() => setViewPayers(true)}
            aria-pressed={!batchKey || viewPayers}
          >
            1 · Payers
          </Button>
          <Button
            className="min-h-11"
            variant={batchKey && !viewPayers ? "default" : "outline"}
            disabled={!batchKey}
            onClick={() => setViewPayers(false)}
            aria-pressed={Boolean(batchKey) && !viewPayers}
          >
            2 · Receipts
          </Button>
          <p className="text-muted-foreground ml-auto text-right text-xs">
            Table amount due
            <strong className="text-foreground block text-lg">{money(amountDue)}</strong>
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          {!batchKey || viewPayers ? (
            <div className="space-y-4">
              {batchKey ? (
                <p className="bg-muted rounded-xl p-3 text-sm">
                  Payer setup is saved. It cannot be edited after requests are created. Return to
                  receipts to continue matching.
                </p>
              ) : null}
              <fieldset disabled={Boolean(batchKey) || submitting} className="space-y-4">
                <label className="block text-sm font-semibold">
                  Payment method
                  <NativeSelect
                    className="mt-2 min-h-11 w-full [&>select]:min-h-11"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="">Select payment method</option>
                    <option value="GOLIS">GOLIS / SAHAL</option>
                    <option value="MYCASH">MYCASH</option>
                    <option value="Dahabshiil">Dahabshiil</option>
                    <option value="OTHER">OTHER</option>
                  </NativeSelect>
                </label>
                {showEqualSplit ? (
                  <div className="bg-muted/30 rounded-xl border p-4">
                    <label className="text-sm font-semibold">
                      Split equally · number of people
                      <Input
                        aria-label="Number of people sharing the bill"
                        type="number"
                        min={2}
                        max={MAX_EQUAL_SPLIT_PEOPLE}
                        step={1}
                        className="mt-2 min-h-11"
                        value={equalSplitCount}
                        onChange={(e) => setEqualSplitCount(e.target.value)}
                      />
                    </label>
                    <Button variant="outline" className="mt-2 min-h-11" onClick={applyEqualSplit}>
                      Create equal shares
                    </Button>
                  </div>
                ) : null}
                {lines.map((line, index) => (
                  <div key={line.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                    <h3 className="font-semibold sm:col-span-2">Payer {index + 1}</h3>
                    <label className="text-sm">
                      Name
                      <Input
                        className="mt-1 min-h-11"
                        aria-invalid={attempted && !line.payerName.trim()}
                        value={line.payerName}
                        onChange={(e) => updateLine(line.id, "payerName", e.target.value)}
                      />
                      {attempted && !line.payerName.trim() ? (
                        <span className="text-destructive mt-1 block text-xs">
                          Enter this payer’s name.
                        </span>
                      ) : null}
                    </label>
                    <label className="text-sm">
                      Phone
                      <Input
                        type="tel"
                        className="mt-1 min-h-11"
                        aria-invalid={attempted && !line.payerPhone.trim()}
                        value={line.payerPhone}
                        onChange={(e) => updateLine(line.id, "payerPhone", e.target.value)}
                      />
                      {attempted && !line.payerPhone.trim() ? (
                        <span className="text-destructive mt-1 block text-xs">
                          Enter this payer’s phone number.
                        </span>
                      ) : null}
                    </label>
                    <label className="text-sm">
                      Amount ($)
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        className="mt-1 min-h-11"
                        aria-invalid={
                          attempted &&
                          (!Number.isFinite(Number(line.amount)) || Number(line.amount) <= 0)
                        }
                        value={line.amount}
                        onChange={(e) => updateLine(line.id, "amount", e.target.value)}
                      />
                    </label>
                    <Button
                      variant="outline"
                      className="min-h-11 self-end"
                      aria-label={`Remove payer ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) => current.filter((item) => item.id !== line.id))
                      }
                    >
                      Remove payer
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    setLines((current) => [
                      ...current,
                      {
                        id: crypto.randomUUID(),
                        payerName: "",
                        payerPhone: "",
                        amount: remaining ? remaining.toFixed(2) : "",
                      },
                    ])
                  }
                >
                  + Add payer
                </Button>
                <dl className="bg-muted/30 space-y-2 rounded-xl border p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt>Table balance</dt>
                    <dd className="font-semibold">{money(amountDue)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Allocated to payers</dt>
                    <dd className="font-semibold">{money(entered)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Unallocated</dt>
                    <dd className="font-semibold">{money(remaining)}</dd>
                  </div>
                  {entered > amountDue ? (
                    <p role="alert" className="text-destructive">
                      Payer amounts exceed the table balance.
                    </p>
                  ) : null}
                </dl>
                {remaining > 0.001 ? (
                  <label className="flex min-h-11 items-start gap-3 rounded-xl border p-4 text-sm">
                    <input
                      type="checkbox"
                      checked={payLater}
                      onChange={(e) => setPayLater(e.target.checked)}
                      className="mt-1 size-4"
                    />
                    <span>
                      <strong>Pay later</strong>
                      <span className="text-muted-foreground block">
                        Create a manager alert for the {money(remaining)} unallocated balance.
                      </span>
                    </span>
                  </label>
                ) : null}
              </fieldset>
              {error ? (
                <p role="alert" className="border-destructive rounded-xl border p-3 text-sm">
                  {error}
                </p>
              ) : null}
              <Button
                className="min-h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800"
                disabled={
                  submitting ||
                  (!batchKey &&
                    (entered <= 0 || entered > amountDue || (remaining > 0.001 && !payLater)))
                }
                onClick={() => (batchKey ? setViewPayers(false) : void startChecks())}
              >
                {submitting
                  ? "Starting…"
                  : batchKey
                    ? "Return to receipts"
                    : "Continue to receipts"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-card sticky -top-4 z-10 rounded-xl border p-3 shadow-sm sm:-top-6">
                <label className="block text-sm font-semibold">
                  Selected payer
                  <NativeSelect
                    className="mt-2 min-h-11 w-full [&>select]:min-h-11"
                    value={selectedRequestId}
                    onChange={(e) => setSelectedRequestId(e.target.value)}
                  >
                    <option value="">Select a payer</option>
                    {requests.map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.payerName} · {money(request.remainingAmount)} remaining
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                {selectedRequest ? (
                  <div className="mt-2 text-sm">
                    <p>
                      {selectedRequest.payerPhone} · {selectedRequest.status.replaceAll("_", " ")}
                    </p>
                    <p>
                      Paid {money(selectedRequest.paidAmount)} / {money(selectedRequest.amount)}
                    </p>
                    <strong>Remaining {money(selectedRequest.remainingAmount)}</strong>
                  </div>
                ) : null}
              </div>
              {syncError ? (
                <div role="alert" className="border-destructive rounded-xl border p-3 text-sm">
                  <p>{syncError}</p>
                  <Button
                    variant="outline"
                    className="mt-2 min-h-11"
                    onClick={() => void refresh()}
                  >
                    Retry refresh
                  </Button>
                </div>
              ) : null}
              <div
                role="group"
                aria-label="Receipt status filters"
                className="flex flex-wrap gap-2"
              >
                {(Object.keys(tabLabels) as ReceiptTab[]).map((item) => (
                  <Button
                    key={item}
                    className="min-h-11"
                    variant={tab === item ? "default" : "outline"}
                    aria-pressed={tab === item}
                    onClick={() => setTab(item)}
                  >
                    {tabLabels[item]} (
                    {receipts.filter((receipt) => receipt.status === item).length})
                  </Button>
                ))}
              </div>
              <Input
                aria-label="Search receipts"
                type="search"
                className="min-h-11"
                placeholder="Name, phone, Tix, table or payer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {!loaded && !syncError ? (
                <p role="status">Refreshing receipts and payer balances…</p>
              ) : null}
              {loaded && !visibleReceipts.length ? (
                <p className="rounded-xl border border-dashed p-4 text-sm">
                  No {tabLabels[tab].toLowerCase()} receipts match.
                </p>
              ) : null}
              {visibleReceipts.map((receipt) => {
                const issue = receiptAssignmentIssue(selectedRequest, receipt);
                return (
                  <article key={receipt.id} className="min-w-0 space-y-3 rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold break-words">
                          {receipt.counterpartyLabel ?? "Unrecognized SAHAL message"}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Tix {receipt.reference ?? "not found"}
                        </p>
                      </div>
                      <strong className="shrink-0">
                        {receipt.amount == null ? "Unknown amount" : money(receipt.amount)}
                      </strong>
                    </div>
                    <p className="text-sm break-words">
                      {receipt.counterpartyIdentifiers.join(", ") || "Phone not found"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {receipt.transactionAt
                        ? new Date(receipt.transactionAt).toLocaleString("en-GB", {
                            timeZone: "Africa/Mogadishu",
                          })
                        : "Time not found"}
                    </p>
                    {receipt.parseError ? (
                      <p className="text-destructive text-sm">{receipt.parseError}</p>
                    ) : null}
                    <details className="bg-muted/40 rounded-lg p-3">
                      <summary className="min-h-11 cursor-pointer text-sm font-semibold">
                        Details / original SMS
                      </summary>
                      <p className="text-xs break-words whitespace-pre-wrap">
                        {receipt.rawMessage}
                      </p>
                      <p className="mt-2 text-xs">
                        Provider balance:{" "}
                        {receipt.providerBalance == null
                          ? "not found"
                          : money(receipt.providerBalance)}
                      </p>
                      {receipt.assignment ? (
                        <p className="mt-2 text-sm">
                          Assigned to {receipt.assignment.payerName} at{" "}
                          {receipt.assignment.table.name} by {receipt.assignedByName ?? "staff"}.
                        </p>
                      ) : null}
                      {receipt.customerCheckout ? (
                        <p className="mt-2 text-sm">
                          Assigned to customer checkout: {receipt.customerCheckout.customerName} ·{" "}
                          {receipt.customerCheckout.payerPhone} ·{" "}
                          {money(receipt.customerCheckout.amount)}.
                        </p>
                      ) : null}
                    </details>
                    {tab === "AVAILABLE" ? (
                      <div>
                        <Button
                          className="h-auto min-h-11 w-full bg-emerald-700 whitespace-normal text-white hover:bg-emerald-800"
                          disabled={
                            Boolean(issue) ||
                            !loaded ||
                            Boolean(syncError) ||
                            Boolean(busyReceiptId)
                          }
                          onClick={() => void assignReceipt(receipt)}
                        >
                          {busyReceiptId === receipt.id
                            ? "Assigning…"
                            : selectedRequest
                              ? `Assign ${money(receipt.amount ?? 0)} to ${selectedRequest.payerName}`
                              : "Select a payer"}
                        </Button>
                        {issue ? (
                          <p className="text-muted-foreground mt-2 text-sm">{issue}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {tab === "ASSIGNED" && canManage ? (
                      <div className="space-y-2 border-t pt-3">
                        <label className="text-sm">
                          Reversal reason (required)
                          <Input
                            className="mt-1 min-h-11"
                            value={reversalReasons[receipt.id] ?? ""}
                            onChange={(e) =>
                              setReversalReasons((current) => ({
                                ...current,
                                [receipt.id]: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <Button
                          variant="destructive"
                          className="min-h-11"
                          disabled={Boolean(busyReceiptId) || !loaded || Boolean(syncError)}
                          onClick={() => void reverseReceipt(receipt)}
                        >
                          Reverse assignment
                        </Button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              <p className="text-muted-foreground text-sm">
                Check the reference, payer, amount and time. Only server-confirmed assignments count
                as paid; any deferred balance still requires settlement.
              </p>
              {complete && loaded && !syncError ? (
                <Button
                  className="h-auto min-h-11 w-full whitespace-normal"
                  onClick={() => {
                    setOpen(false);
                    router.refresh();
                  }}
                >
                  All payer rows matched · return to tables
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
