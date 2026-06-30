"use client";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  rejectDeliveryAction,
  retryDeliveryExtractionAction,
} from "../actions";
import InvoiceReviewForm from "./InvoiceReviewForm";

type Target = { value: string; label: string };
type DeliveryItem = {
  id: string;
  description: string;
  matchedTarget: string;
  quantity: string;
  verifiedQuantity: number | null;
  unitPrice: string;
  totalPrice: string;
};

export default function DeliveryVerificationForm({
  deliveryId,
  status,
  extractionError,
  extractedText,
  reviewedText,
  invoiceNumber,
  receiptDate,
  targets,
  items,
}: {
  deliveryId: string;
  status: string;
  extractionError: string | null;
  extractedText: string;
  reviewedText: string;
  invoiceNumber: string;
  receiptDate: string;
  targets: Target[];
  items: DeliveryItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  function run(
    action: (data: FormData) => Promise<void>,
    data: FormData,
    success: string,
  ) {
    setMessage("");
    startTransition(async () => {
      try {
        await action(data);
        setHasError(false);
        setMessage(success);
        router.refresh();
      } catch (error) {
        setHasError(true);
        setMessage(
          error instanceof Error ? error.message : "The request failed.",
        );
      }
    });
  }

  function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm("Reject this delivery without updating inventory?")) {
      run(
        rejectDeliveryAction,
        new FormData(event.currentTarget),
        "Delivery rejected.",
      );
    }
  }

  if (status === "VERIFIED")
    return (
      <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
        This invoice was accepted and inventory was updated.
      </p>
    );
  if (status === "REJECTED")
    return (
      <p className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">
        This delivery was rejected. Inventory was not changed.
      </p>
    );

  if (status === "PENDING_EXTRACTION") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-black text-amber-900">
          Invoice extraction pending
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {extractionError || "The invoice has not been extracted yet."}
        </p>
        <form
          className="mt-4"
          action={(data) =>
            run(
              retryDeliveryExtractionAction,
              data,
              "Invoice extraction completed.",
            )
          }
        >
          <Input type="hidden" name="deliveryId" value={deliveryId} />
          <Button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "Extractingâ€¦" : "Retry invoice extraction"}
          </Button>
        </form>
        {message ? (
          <p
            role="status"
            className={`mt-3 rounded-xl p-3 text-sm font-semibold ${hasError ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <InvoiceReviewForm
        deliveryId={deliveryId}
        extractedText={extractedText}
        reviewedText={reviewedText}
        invoiceNumber={invoiceNumber}
        receiptDate={receiptDate}
        targets={targets}
        initialItems={items.map((item) => ({
          id: item.id,
          description: item.description,
          target: item.matchedTarget,
          quantity: item.verifiedQuantity?.toString() || item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }))}
      />
      <form
        onSubmit={reject}
        className="rounded-2xl border border-red-200 bg-red-50 p-4"
      >
        <Input type="hidden" name="deliveryId" value={deliveryId} />
        <label
          htmlFor="delivery-rejection-reason"
          className="text-sm font-bold text-red-900"
        >
          Rejection reason
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="delivery-rejection-reason"
            name="reason"
            className="h-10 flex-1 rounded-lg border border-red-200 px-3"
            placeholder="Optional audit note"
          />
          <Button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            Reject delivery
          </Button>
        </div>
      </form>
      {message ? (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm font-semibold ${hasError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
