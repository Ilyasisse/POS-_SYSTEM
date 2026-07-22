"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSupplierBillDueDateAction } from "../../supplier-deliveries/actions";

export default function DueDateForm({
  billId,
  dueDate,
}: {
  billId: string;
  dueDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage("");
    startTransition(async () => {
      try {
        await updateSupplierBillDueDateAction(data);
        setHasError(false);
        setMessage("Due date updated.");
        router.refresh();
      } catch (error) {
        setHasError(true);
        setMessage(
          error instanceof Error ? error.message : "Due date update failed.",
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid min-w-44 gap-2">
      <Input type="hidden" name="billId" value={billId} />
      <Input
        required
        aria-label="Supplier bill due date"
        name="dueDate"
        type="date"
        defaultValue={dueDate}
        className="h-9"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving..." : "Update due date"}
      </Button>
      {message ? (
        <p
          role="status"
          className={`text-xs font-semibold ${hasError ? "text-red-700" : "text-emerald-700"}`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
