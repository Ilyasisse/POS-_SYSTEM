"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { previewSupplierAdvance, recordSupplierAdvance } from "./actions";
type Preview = Awaited<ReturnType<typeof previewSupplierAdvance>>;
export default function SupplierPaymentComposer({ supplierId }: { supplierId: string }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("GOLIS");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError("");
          try {
            if (!preview) {
              setPreview(await previewSupplierAdvance(supplierId, Number(amount)));
              return;
            }
            const data = new FormData();
            data.set("supplierId", supplierId);
            data.set("amount", amount);
            data.set("paymentMethod", method);
            data.set("notes", note);
            await recordSupplierAdvance(data);
            setPreview(null);
            setAmount("");
            setNote("");
            toast({ description: "Supplier account details refreshed.", tone: "success", title: "Supplier payment recorded" });
            router.refresh();
          } catch {
            setError("Check the amount and payment details, then try again.");
            toast({ description: "Supplier account details refreshed.", tone: "error", title: "Payment not recorded" });
          }
        });
      }}
    >
      <p className="text-muted-foreground text-sm">
        Log a payment already made. This does not transfer money.
      </p>
      <label className="grid gap-1 text-sm">
        Amount (USD)
        <Input
          required
          type="number"
          min="0.01"
          max="9999999999.99"
          step="0.01"
          value={amount}
          disabled={pending}
          onChange={(e) => {
            setAmount(e.target.value);
            setPreview(null);
          }}
          aria-invalid={!!error}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Method
        <select
          value={method}
          disabled={pending}
          className="bg-background h-11 rounded-lg border px-3"
          onChange={(e) => {
            setMethod(e.target.value);
            setPreview(null);
          }}
        >
          {["GOLIS", "MYCASH", "Dahabshiil", "Cash", "Bank", "Other"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Reference / note (optional)
        <Input
          value={note}
          disabled={pending}
          maxLength={500}
          onChange={(e) => {
            setNote(e.target.value);
            setPreview(null);
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {preview ? (
        <section aria-live="polite" className="rounded-xl border p-4">
          <h3 className="font-semibold">How this payment will be applied</h3>
          <p className="text-muted-foreground text-xs">
            Earliest due invoices and installments first. Estimate; balances are rechecked on save.
          </p>
          {preview.allocations.map((a, i) => (
            <p key={i} className="flex justify-between gap-3 border-b py-2">
              <span>
                Invoice #{a.invoiceNumber}
                {a.installment ? " · installment" : ""}
              </span>
              <strong>${a.amount}</strong>
            </p>
          ))}
          <p className="mt-3">
            Estimated balance remaining: <strong>${preview.remaining}</strong>
          </p>
          <p>
            New unused credit: <strong>${preview.credit}</strong>
          </p>
        </section>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending
          ? "Processing…"
          : preview
            ? `Record $${Number(amount).toFixed(2)} payment`
            : "Preview payment"}
      </Button>
    </form>
  );
}
