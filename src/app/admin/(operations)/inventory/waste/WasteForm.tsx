"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { submitSupplyWaste, type WasteFormState } from "./actions";

type SupplyChoice = {
  id: string;
  name: string;
  unit: string;
  stockQty: string;
};

export function WasteForm({ supplies }: { supplies: SupplyChoice[] }) {
  const [state, action, pending] = useActionState<WasteFormState, FormData>(
    submitSupplyWaste,
    null,
  );
  const form = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      form.current?.reset();
      toast({
        tone: state.message.includes("needs attention") ? "warning" : "success",
        description: state.message,
      });
    } else if (!state.errors) {
      toast({ tone: "error", description: state.message });
    }
  }, [state, toast]);

  return (
    <form ref={form} action={action} className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1 text-sm font-semibold">
        Supply
        <select
          name="supplyId"
          required
          defaultValue=""
          className="h-10 rounded-md border px-3"
          aria-invalid={Boolean(state?.errors?.supplyId)}
        >
          <option value="" disabled>
            Choose a supply
          </option>
          {supplies.map((supply) => (
            <option key={supply.id} value={supply.id}>
              {supply.name} · {supply.stockQty} {supply.unit} available
            </option>
          ))}
        </select>
        {state?.errors?.supplyId && (
          <span className="text-red-700">{state.errors.supplyId}</span>
        )}
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Cause
        <select
          name="type"
          className="h-10 rounded-md border px-3"
          aria-invalid={Boolean(state?.errors?.type)}
        >
          <option value="WASTE">Waste</option>
          <option value="SPOILAGE">Spoilage</option>
          <option value="DAMAGE">Damage</option>
        </select>
        {state?.errors?.type && (
          <span className="text-red-700">{state.errors.type}</span>
        )}
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Quantity in the supply’s canonical unit
        <Input
          name="quantity"
          type="number"
          min="0.000001"
          step="0.000001"
          required
          aria-invalid={Boolean(state?.errors?.quantity)}
        />
        {state?.errors?.quantity && (
          <span className="text-red-700">{state.errors.quantity}</span>
        )}
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        What happened?
        <Input
          name="reason"
          minLength={3}
          maxLength={200}
          required
          placeholder="e.g. Expired in fridge"
          aria-invalid={Boolean(state?.errors?.reason)}
        />
        {state?.errors?.reason && (
          <span className="text-red-700">{state.errors.reason}</span>
        )}
      </label>
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending || supplies.length === 0}>
          {pending ? "Recording…" : "Record stock loss"}
        </Button>
      </div>
    </form>
  );
}
