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
import type { DailyCashPaidBreakdownRow } from "@/lib/daily-cash/types";
import { undoPaidActivityAction } from "./actions";

const consequences: Record<DailyCashPaidBreakdownRow["type"], string> = {
  SALARY: "The combined salary will become unpaid and its cash will be restored.",
  MANUAL: "The one-time expense will be removed and its cash will be restored.",
  SUPPLIER: "The supplier payment will be removed, its cash restored, and the invoice or installment balance recalculated.",
  SUPPLY: "The supply payment will be removed, its cash restored, and the remaining supply balance recalculated.",
};

export default function UndoPaidActivityButton({
  date,
  row,
}: {
  date: string;
  row: DailyCashPaidBreakdownRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function confirmUndo(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await undoPaidActivityAction({ date, type: row.type, rowId: row.id });
        setOpen(false);
        toast({ tone: "success", description: "Payment undone." });
        router.refresh();
      } catch (error) {
        toast({
          tone: "error",
          description:
            error instanceof Error ? error.message : "Could not undo this payment.",
        });
      }
    });
  }

  return <AlertDialog open={open} onOpenChange={setOpen}>
    <AlertDialogTrigger asChild><Button type="button" size="sm" variant="outline">Undo</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Undo this {row.type.toLowerCase()} payment?</AlertDialogTitle>
        <AlertDialogDescription>{consequences[row.type]}</AlertDialogDescription>
      </AlertDialogHeader>
      <p className="text-sm font-medium">{row.description}</p>
      <AlertDialogFooter>
        <AlertDialogCancel type="button" disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction type="button" variant="destructive" disabled={pending} onClick={confirmUndo}>
          {pending ? "Undoing..." : "Undo payment"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
