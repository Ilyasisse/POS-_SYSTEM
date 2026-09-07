"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useToast } from "@/components/ui/toast";
import {
  createSupplierInvoiceRecurrenceAction,
  pauseSupplierInvoiceRecurrenceAction,
  resumeSupplierInvoiceRecurrenceAction,
  updateSupplierInvoiceRecurrenceAction,
} from "../actions";

type Recurrence = {
  id: string;
  interval: number;
  unit: "DAY" | "WEEK" | "MONTH";
  nextRunDate: string;
  isActive: boolean;
  lastGeneratedAtLabel: string | null;
  lastError: string | null;
  lastErrorAtLabel: string | null;
  pausedAt: string | null;
  generatedCount: number;
};

type RecurrenceAction = (formData: FormData) => Promise<{ message: string }>;

export default function RecurringInvoiceCard({
  invoiceId,
  recurrence,
  eligible,
  todayDateKey,
  defaultNextRunDate,
}: {
  invoiceId: string;
  recurrence: Recurrence | null;
  eligible: boolean;
  todayDateKey: string;
  defaultNextRunDate: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  if (!recurrence && !eligible) return null;

  function runAction(action: RecurrenceAction, submittedFormData?: FormData) {
    const formData = submittedFormData ??
      (formRef.current ? new FormData(formRef.current) : null);
    if (!formData) return;
    startTransition(async () => {
      try {
        const result = await action(formData);
        toast({ tone: "success", description: result.message });
        router.refresh();
      } catch (error) {
        toast({
          tone: "error",
          description:
            error instanceof Error
              ? error.message
              : "The recurring schedule could not be updated.",
        });
      }
    });
  }

  return (
    <Card className="gap-5 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Recurring invoice</h2>
          <p className="text-sm text-muted-foreground">
            Generate future drafts using this invoice&apos;s items and current
            supplier catalog prices.
          </p>
        </div>
        {recurrence ? (
          <span className="w-fit rounded-full border px-2.5 py-1 text-xs font-semibold">
            {recurrence.isActive ? "ACTIVE" : "PAUSED"}
          </span>
        ) : null}
      </div>

      {recurrence?.lastError ? (
        <Alert variant="destructive">
          <AlertTitle>Generation needs attention</AlertTitle>
          <AlertDescription>
            {recurrence.lastError}
            {recurrence.lastErrorAtLabel
              ? ` Last attempted ${recurrence.lastErrorAtLabel}.`
              : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        ref={formRef}
        className="grid gap-4"
        action={(formData) => {
          runAction(
            recurrence
              ? recurrence.isActive
                ? updateSupplierInvoiceRecurrenceAction
                : resumeSupplierInvoiceRecurrenceAction
              : createSupplierInvoiceRecurrenceAction,
            formData,
          );
        }}
      >
        <input type="hidden" name="invoiceId" value={invoiceId} />
        {recurrence ? (
          <input type="hidden" name="recurrenceId" value={recurrence.id} />
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="detail-recurrence-interval">Repeat every</Label>
            <Input
              id="detail-recurrence-interval"
              name="recurrenceInterval"
              type="number"
              min="1"
              max="365"
              step="1"
              defaultValue={recurrence?.interval ?? 1}
              required
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="detail-recurrence-unit">Interval</Label>
            <NativeSelect
              id="detail-recurrence-unit"
              name="recurrenceUnit"
              defaultValue={recurrence?.unit ?? "MONTH"}
              required
              disabled={pending}
            >
              <option value="DAY">Days</option>
              <option value="WEEK">Weeks</option>
              <option value="MONTH">Months</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="detail-recurrence-next-date">
              Next invoice date
            </Label>
            <Input
              id="detail-recurrence-next-date"
              name="recurrenceNextRunDate"
              type="date"
              min={todayDateKey}
              defaultValue={recurrence?.nextRunDate ?? defaultNextRunDate}
              required
              disabled={pending}
            />
          </div>
        </div>

        {recurrence ? (
          <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <p>{recurrence.generatedCount} generated draft(s)</p>
            <p>
              Last generated: {recurrence.lastGeneratedAtLabel
                ? recurrence.lastGeneratedAtLabel
                : "Not yet"}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Working..."
              : !recurrence
                ? "Create recurring schedule"
                : recurrence.isActive
                  ? "Save schedule"
                  : "Resume schedule"}
          </Button>
          {recurrence?.isActive ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => runAction(pauseSupplierInvoiceRecurrenceAction)}
            >
              Pause schedule
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
