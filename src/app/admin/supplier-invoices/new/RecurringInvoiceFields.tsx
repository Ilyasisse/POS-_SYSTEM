"use client";

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export default function RecurringInvoiceFields({
  enabled,
  pending,
  todayDateKey,
  defaultNextRunDate,
  onEnabledChange,
}: {
  enabled: boolean;
  pending: boolean;
  todayDateKey: string;
  defaultNextRunDate: string;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start gap-3">
        <Checkbox
          id="recurrenceEnabled"
          name="recurrenceEnabled"
          checked={enabled}
          onCheckedChange={(checked) => onEnabledChange(checked === true)}
          disabled={pending}
        />
        <div className="grid gap-1">
          <Label htmlFor="recurrenceEnabled">Make this invoice recurring</Label>
          <p className="text-sm text-muted-foreground">
            Future occurrences use current supplier catalog prices and are
            created as drafts for review.
          </p>
        </div>
      </div>
      {enabled ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="recurrenceInterval">Repeat every</Label>
            <Input
              id="recurrenceInterval"
              name="recurrenceInterval"
              type="number"
              min="1"
              max="365"
              step="1"
              defaultValue="1"
              required
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="recurrenceUnit">Interval</Label>
            <NativeSelect
              id="recurrenceUnit"
              name="recurrenceUnit"
              defaultValue="MONTH"
              required
              disabled={pending}
            >
              <option value="DAY">Days</option>
              <option value="WEEK">Weeks</option>
              <option value="MONTH">Months</option>
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="recurrenceNextRunDate">Next invoice date</Label>
            <Input
              id="recurrenceNextRunDate"
              name="recurrenceNextRunDate"
              type="date"
              min={todayDateKey}
              defaultValue={defaultNextRunDate}
              required
              disabled={pending}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
