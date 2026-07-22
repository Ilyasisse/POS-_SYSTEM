"use client";

import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";

import { Input } from "@/components/ui/input";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveExtractedDeliveryAction,
  retryDeliveryExtractionAction,
} from "../actions";
import InvoiceLineItemsEditor, {
  type ReviewRow,
  type Target,
} from "./InvoiceLineItemsEditor";

const blankRow = (id: string): ReviewRow => ({
  id,
  description: "",
  target: "",
  quantity: "",
  unitPrice: "",
  totalPrice: "",
});

export default function InvoiceReviewForm({
  deliveryId,
  extractedText,
  reviewedText,
  invoiceNumber,
  receiptDate,
  dueDate,
  targets,
  initialItems,
}: {
  deliveryId: string;
  extractedText: string;
  reviewedText: string;
  invoiceNumber: string;
  receiptDate: string;
  dueDate: string;
  targets: Target[];
  initialItems: ReviewRow[];
}) {
  const router = useRouter();
  const nextRowId = useRef(initialItems.length + 1);
  const [rows, setRows] = useState<ReviewRow[]>(
    initialItems.length ? initialItems : [blankRow("new-1")],
  );
  const [pending, startTransition] = useTransition();
  const [extractionPending, startExtractionTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  function addRow() {
    const id = `new-${nextRowId.current++}`;
    setRows((current) => [...current, blankRow(id)]);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !confirm(
        "Accept this invoice, update inventory, and create the supplier bill? This cannot be undone.",
      )
    )
      return;

    const data = new FormData(event.currentTarget);
    setMessage("");
    startTransition(async () => {
      try {
        await approveExtractedDeliveryAction(data);
        setHasError(false);
        setMessage(
          "Invoice accepted. Inventory and the supplier bill were updated.",
        );
        router.refresh();
      } catch (error) {
        setHasError(true);
        setMessage(
          error instanceof Error ? error.message : "Invoice approval failed.",
        );
      }
    });
  }

  function rerunExtraction() {
    if (
      !confirm(
        "Re-run invoice extraction? Unsaved edits on this page will be lost, but saved reviewed text is preserved.",
      )
    )
      return;
    const data = new FormData();
    data.set("deliveryId", deliveryId);
    setMessage("");
    startExtractionTransition(async () => {
      try {
        await retryDeliveryExtractionAction(data);
        setHasError(false);
        setMessage(
          "Invoice extraction completed. Review the refreshed data before accepting.",
        );
        router.refresh();
      } catch (error) {
        setHasError(true);
        setMessage(
          error instanceof Error ? error.message : "Invoice extraction failed.",
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Input type="hidden" name="deliveryId" value={deliveryId} />
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-blue-950">
              Review extracted invoice
            </h3>
            <p className="mt-1 text-sm text-blue-800">
              Compare every field with the original image. Inventory changes
              only after acceptance.
            </p>
          </div>
          <Button
            type="button"
            onClick={rerunExtraction}
            disabled={pending || extractionPending}
            className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50"
          >
            {extractionPending
              ? "Extracting invoiceâ€¦"
              : "Re-run invoice extraction"}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <label
          htmlFor="invoice-number"
          className="text-sm font-bold text-slate-700"
        >
          Invoice number
          <Input
            id="invoice-number"
            name="invoiceNumber"
            maxLength={200}
            defaultValue={invoiceNumber}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal"
          />
        </label>
        <label
          htmlFor="invoice-date"
          className="text-sm font-bold text-slate-700"
        >
          Invoice date
          <Input
            id="invoice-date"
            name="receiptDate"
            type="date"
            defaultValue={receiptDate}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal"
          />
        </label>
        <label
          htmlFor="supplier-bill-due-date"
          className="text-sm font-bold text-slate-700"
        >
          Bill due date
          <Input
            required
            id="supplier-bill-due-date"
            name="dueDate"
            type="date"
            defaultValue={dueDate}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Defaults to tomorrow; change it to match the supplier&apos;s terms.
          </span>
        </label>
      </div>

      <label
        htmlFor="reviewed-invoice-text"
        className="block text-sm font-bold text-slate-700"
      >
        Reviewed invoice text
        <Textarea
          id="reviewed-invoice-text"
          name="reviewedText"
          rows={12}
          maxLength={20000}
          defaultValue={reviewedText || extractedText}
          className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"
        />
      </label>

      <InvoiceLineItemsEditor
        rows={rows}
        targets={targets}
        onRemove={removeRow}
      />

      <Button
        type="button"
        onClick={addRow}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
      >
        Add invoice item
      </Button>
      <Textarea
        aria-label="Manager verification notes"
        name="notes"
        rows={3}
        maxLength={2000}
        placeholder="Manager verification notes"
        className="w-full rounded-xl border border-slate-200 p-3 text-sm"
      />
      <Button
        type="submit"
        disabled={pending || extractionPending}
        className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-50"
      >
        {pending ? "Acceptingâ€¦" : "Accept invoice and update inventory"}
      </Button>
      {message ? (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm font-semibold ${hasError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
