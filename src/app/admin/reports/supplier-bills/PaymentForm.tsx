"use client";

import { Button } from "@/components/ui/button";

import { NativeSelect } from "@/components/ui/native-select";

import { Input } from "@/components/ui/input";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentAction } from "./actions";

export default function PaymentForm({
  supplierId,
  billId,
  remaining,
  installmentId,
}: {
  supplierId: string;
  billId: string;
  remaining: number;
  installmentId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState(() => remaining.toFixed(2));
  const router = useRouter();
  const includesExtra = Number(amount) > remaining;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage("");
    startTransition(async () => {
      try {
        await recordPaymentAction(data);
        setMessage("Payment recorded.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Payment failed.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid min-w-64 gap-2">
      <Input type="hidden" name="billId" value={billId} />
      <Input type="hidden" name="supplierId" value={supplierId} />
      {installmentId ? (
        <Input type="hidden" name="installmentId" value={installmentId} />
      ) : null}
      <div className="flex gap-2">
        <Input
          required
          name="amount"
          type="number"
          min="0.1"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="h-9 w-28 rounded-lg border border-slate-200 px-2"
          aria-label="Payment amount"
        />
        <NativeSelect
          name="paymentMethod"
          className="h-9 min-w-28 rounded-lg border border-slate-200 px-2"
          aria-label="Payment method"
        >
          <option value="">Method</option>
          <option>MYCASH</option>
          <option>GOLIS</option>
          <option>Dahabshiil</option>
          <option>Cash</option>
          <option>Bank</option>
          <option>Other</option>
        </NativeSelect>
      </div>
      <Input
        name="notes"
        placeholder="Payment note"
        className="h-9 rounded-lg border border-slate-200 px-2"
      />
      {includesExtra ? (
        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-950">
          <Input
            type="checkbox"
            name="allowOverpayment"
            required
            className="mt-0.5 size-4"
          />
          Use the extra amount for this supplier&apos;s other open invoices,
          then keep any remainder as future credit.
        </label>
      ) : null}
      <Button
        disabled={pending}
        className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white disabled:opacity-50"
      >
        {pending ? "Recordingâ€¦" : remaining > 0 ? "Record payment" : "Paid"}
      </Button>
      {message ? (
        <span className="text-md font-semibold text-red-600">{message}</span>
      ) : null}
    </form>
  );
}
