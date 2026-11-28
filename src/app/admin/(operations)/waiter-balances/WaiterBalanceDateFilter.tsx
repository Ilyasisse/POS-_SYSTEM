"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WaiterBalanceDateFilterProps = {
  latestCompletedBusinessDate: string;
  ledgerStartDate: string;
  selectedBusinessDate: string;
  showInactive: boolean;
};

function submitFilter(control: HTMLElement) {
  control.closest("form")?.requestSubmit();
}

export function WaiterBalanceDateFilter({
  latestCompletedBusinessDate,
  ledgerStartDate,
  selectedBusinessDate,
  showInactive,
}: WaiterBalanceDateFilterProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="business-date">POS business date</Label>
      <Input
        id="business-date"
        name="date"
        type="date"
        min={ledgerStartDate}
        max={latestCompletedBusinessDate}
        defaultValue={selectedBusinessDate}
        onChange={(event) => submitFilter(event.currentTarget)}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="show-inactive"
          name="showInactive"
          value="1"
          defaultChecked={showInactive}
          onClick={(event) =>
            queueMicrotask(() => submitFilter(event.currentTarget))
          }
        />
        <Label htmlFor="show-inactive" className="text-sm font-normal">
          Show inactive waiters
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Inactive waiters are hidden unless you enable this filter.
      </p>
    </div>
  );
}
