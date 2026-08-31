"use client";

import { useEffect, useMemo, useState } from "react";
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

type Line = {
  id: string;
  payerName: string;
  payerPhone: string;
  amount: string;
  method: string;
};
type RequestLine = {
  id: string;
  payerName: string;
  payerPhone: string;
  amount: number;
  method: string;
  status: string;
  reference?: string | null;
};
const money = (value: number) => `$${value.toFixed(2)}`;

export default function CashierPaymentDialog({
  tableId,
  tableName,
  amountDue,
}: {
  tableId: string;
  tableName: string;
  amountDue: number;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    {
      id: crypto.randomUUID(),
      payerName: "",
      payerPhone: "",
      amount: amountDue.toFixed(2),
      method: "",
    },
  ]);
  const [payLater, setPayLater] = useState(false);
  const [batchKey, setBatchKey] = useState("");
  const [requests, setRequests] = useState<RequestLine[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const entered = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines],
  );
  const remaining = Math.max(0, amountDue - entered);
  const complete =
    requests.length > 0 &&
    requests.every((request) => request.status === "MATCHED");

  useEffect(() => {
    if (!batchKey || complete) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(
        `/api/cashier/payment-requests?batchKey=${encodeURIComponent(batchKey)}`,
        { cache: "no-store" },
      );
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests ?? []);
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [batchKey, complete]);

  function updateLine(
    id: string,
    field: keyof Omit<Line, "id">,
    value: string,
  ) {
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, [field]: value } : line,
      ),
    );
  }

  async function startChecks() {
    setError("");
    if (lines.some((line) => !line.method)) {
      setError("Select a payment method for every payer.");
      return;
    }
    const key = crypto.randomUUID();
    setSubmitting(true);
    try {
      const response = await fetch("/api/cashier/payment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchKey: key,
          tableId,
          payLater,
          lines: lines.map((line) => ({
            payerName: line.payerName,
            payerPhone: line.payerPhone,
            amount: Number(line.amount),
            method: line.method,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not start payment checks.");
      setBatchKey(key);
      setRequests(data.requests ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not start payment checks.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="min-h-11 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800">
          Take payment · {money(amountDue)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-[2rem] p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-3xl">
            Payment for {tableName}
          </DialogTitle>
          <DialogDescription>
            Enter each payer and payment provider. Every row is confirmed
            separately, so customers can use different methods on one bill.
          </DialogDescription>
        </DialogHeader>

        {!batchKey ? (
          <div className="space-y-5">
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className="grid gap-2 rounded-2xl border p-3 sm:grid-cols-[8rem_1fr_1fr_7rem_auto]"
                >
                  <NativeSelect
                    aria-label={`Payer ${index + 1} payment method`}
                    value={line.method}
                    onChange={(event) =>
                      updateLine(line.id, "method", event.target.value)
                    }
                  >
                    <option value="">Method</option>
                    <option value="GOLIS">GOLIS</option>
                    <option value="MYCASH">MYCASH</option>
                    <option value="Dahabshiil">Dahabshiil</option>
                    <option value="OTHER">OTHER</option>
                  </NativeSelect>
                  <Input
                    aria-label={`Payer ${index + 1} name`}
                    placeholder="Name"
                    value={line.payerName}
                    onChange={(event) =>
                      updateLine(line.id, "payerName", event.target.value)
                    }
                  />
                  <Input
                    aria-label={`Payer ${index + 1} phone`}
                    placeholder="Phone number"
                    value={line.payerPhone}
                    onChange={(event) =>
                      updateLine(line.id, "payerPhone", event.target.value)
                    }
                  />
                  <Input
                    aria-label={`Payer ${index + 1} amount`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.amount}
                    onChange={(event) =>
                      updateLine(line.id, "amount", event.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((item) => item.id !== line.id),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    payerName: "",
                    payerPhone: "",
                    amount: remaining ? remaining.toFixed(2) : "",
                    method: current.at(-1)?.method ?? "",
                  },
                ])
              }
            >
              + Add another payer
            </Button>
            <div
              className={`rounded-2xl border p-4 ${Math.abs(remaining) < 0.001 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
            >
              <div className="flex justify-between">
                <span>Table balance</span>
                <strong>{money(amountDue)}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Entered payments</span>
                <strong>{money(entered)}</strong>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Remaining</span>
                <strong>{money(remaining)}</strong>
              </div>
            </div>
            {remaining > 0.001 ? (
              <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <input
                  type="checkbox"
                  checked={payLater}
                  onChange={(event) => setPayLater(event.target.checked)}
                  className="mt-1 size-4"
                />
                <span>
                  <strong>Pay later</strong>
                  <span className="block text-sm text-amber-900">
                    Create a manager alert for the {money(remaining)} balance
                    and record which cashier deferred it.
                  </span>
                </span>
              </label>
            ) : null}
            {error ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              onClick={startChecks}
              disabled={
                submitting ||
                entered <= 0 ||
                entered > amountDue ||
                (remaining > 0.001 && !payLater)
              }
              className="w-full rounded-full bg-stone-950 py-4 text-white"
            >
              {submitting ? "Starting…" : "Start payment check"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Waiting for MacroDroid callbacks from A98. This screen refreshes
              automatically.
            </div>
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-2xl border p-4"
              >
                <div>
                  <p className="font-semibold">
                    {request.payerName} · {request.payerPhone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {request.method} · {money(request.amount)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === "MATCHED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {request.status}
                </span>
              </div>
            ))}
            {complete ? (
              <Button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-full bg-emerald-700 py-4 text-white"
              >
                Payment confirmed · return to cashier
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
