"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initializeWaiterOpeningBalance } from "./actions";

type InitializationDialogProps = {
  waiterId: string;
  waiterName: string;
  businessDate: string;
  showInactive: boolean;
};

export function InitializationDialog({
  waiterId,
  waiterName,
  businessDate,
  showInactive,
}: InitializationDialogProps) {
  const [openingBalance, setOpeningBalance] = useState("0.00");

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <LockKeyhole aria-hidden="true" />
          Set opening
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={initializeWaiterOpeningBalance}>
          <input type="hidden" name="waiterId" value={waiterId} />
          <input type="hidden" name="businessDate" value={businessDate} />
          {showInactive ? (
            <input type="hidden" name="showInactive" value="1" />
          ) : null}
          <AlertDialogHeader>
            <AlertDialogMedia>
              <LockKeyhole aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Lock {waiterName}&apos;s opening balance?</AlertDialogTitle>
            <AlertDialogDescription>
              This one-time July 1 balance cannot be edited later. Enter zero
              when there is no previous shortage, or a negative amount for debt.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4 grid gap-2">
            <Label htmlFor={`opening-${waiterId}`}>Opening balance</Label>
            <Input
              id={`opening-${waiterId}`}
              name="openingBalance"
              type="number"
              inputMode="decimal"
              step="0.01"
              max="0"
              required
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Allowed values: $0.00 or a negative amount such as -$10.00.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit">Lock balance</AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
