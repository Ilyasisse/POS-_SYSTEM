"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSupply } from "../actions";
import { useSupplyForm } from "./useSupplyForm";

export default function CreateSupplyForm() {
  const { submit, pending, error, errorId, fieldError } = useSupplyForm(
    createSupply,
    "Supply added.",
    true,
  );
  return (
    <Card className="p-4">
      <form onSubmit={submit}>
        <fieldset
          disabled={pending}
          className="grid items-start gap-3 lg:grid-cols-[1fr_1fr_0.55fr_0.55fr_auto]"
        >
          <Input
            aria-label="Supply name"
            name="name"
            type="text"
            placeholder="Item name"
            {...fieldError("name")}
            required
          />
          <div className="space-y-2">
            <Input
              aria-label="Supply unit"
              name="unit"
              type="text"
              placeholder="Unit (e.g. kg or Box)"
              {...fieldError("unit")}
            />
            <label className="text-muted-foreground flex items-start gap-2 text-xs">
              <input type="checkbox" name="countAsEntered" value="yes" className="mt-0.5" />
              Count each custom unit as one
            </label>
            {error?.field === "unit" ? (
              <p id={errorId} role="alert" className="text-destructive text-sm">
                {error.error}
              </p>
            ) : null}
          </div>
          <Input
            aria-label="Initial stock quantity"
            name="stockQty"
            type="number"
            min="0"
            step="any"
            placeholder="Stock"
            {...fieldError("stockQty")}
          />
          <Input
            aria-label="Low-stock threshold"
            name="lowStockThreshold"
            type="number"
            min="0"
            step="any"
            placeholder="Low"
            {...fieldError("lowStockThreshold")}
          />
          <Button type="submit">{pending ? "Adding…" : "Add Supply"}</Button>
        </fieldset>
        {error && error.field !== "unit" ? (
          <p id={errorId} role="alert" className="text-destructive mt-2 text-sm">
            {error.error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
