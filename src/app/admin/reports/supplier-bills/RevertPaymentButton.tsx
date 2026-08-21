"use client";

import { type MouseEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { revertSupplierPaymentAction } from "./actions";

export default function RevertPaymentButton({
  paymentId,
  amount,
  disabledReason,
}: {
  paymentId: string;
  amount: string;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  if (disabledReason) {
    return (
      <div className="mt-1">
        <Button type="button" size="sm" variant="ghost" disabled>
          Revert
        </Button>
        <p className="text-[11px] font-medium text-amber-700">
          {disabledReason}
        </p>
      </div>
    );
  }

  function confirmRevert(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      try {
        await revertSupplierPaymentAction(paymentId);
        setOpen(false);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Could not revert payment.",
        );
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="mt-1">
          Revert
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revert this {amount} payment?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the full supplier payment, removes its
            invoice allocations, and recalculates every affected balance. Any
            invoice paid by this payment may reopen. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {message ? (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {message}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={confirmRevert}
          >
            {pending ? "Reverting..." : "Revert payment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
