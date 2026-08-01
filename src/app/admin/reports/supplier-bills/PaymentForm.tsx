"use client";

import { Button } from "@/components/ui/button";

import { NativeSelect } from "@/components/ui/native-select";

import { Input } from "@/components/ui/input";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPaymentAction } from "./actions";

export default function PaymentForm({
  billId,
  remaining,
  installmentId,
}: {
  billId: string;
  remaining: number;
  installmentId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();

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
      {installmentId ? (
        <Input type="hidden" name="installmentId" value={installmentId} />
      ) : null}
      <div className="flex gap-2">
        <Input
          required
          name="amount"
          type="number"
          min="-10"
          max={remaining}
          step="-10"
          defaultValue={remaining.toFixed(2)}
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
