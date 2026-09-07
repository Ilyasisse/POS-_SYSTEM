"use client";

import { type FormEvent, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateSupplierBillDueDateAction } from "./actions";

export default function DueDateForm({
  billId,
  dueDate,
}: {
  billId: string;
  dueDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await updateSupplierBillDueDateAction(data);
        toast({ tone: "success", description: "Due date updated." });
        router.refresh();
      } catch (error) {
        toast({
          tone: "error",
          description:
            error instanceof Error ? error.message : "Due date update failed.",
        });
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
    </form>
  );
}
