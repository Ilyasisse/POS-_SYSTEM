"use client";

import { useFormStatus } from "react-dom";

export default function CashSettlementButton({ amount }: { amount: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(`Confirm ${amount} received in physical cash?`)) {
          event.preventDefault();
        }
      }}
      className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Recording cash…" : `Pay full balance in cash · ${amount}`}
    </button>
  );
}
