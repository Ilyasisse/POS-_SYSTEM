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
import { useToast } from "@/components/ui/toast";
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
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

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
    startTransition(async () => {
      try {
        await revertSupplierPaymentAction(paymentId);
        setOpen(false);
        toast({ tone: "success", description: "Payment reverted." });
        router.refresh();
      } catch (error) {
        toast({
          tone: "error",
          description:
            error instanceof Error ? error.message : "Could not revert payment.",
        });
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
