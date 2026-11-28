"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { editSupply } from "../actions";
import { useSupplyForm } from "../_compoents/useSupplyForm";

type SupplyDetails = {
  id: string;
  name: string;
  unit: string;
  stockQty: string;
  lowStockThreshold: string;
  version: string;
};

export default function SupplyDetailsForm({ supply }: { supply: SupplyDetails }) {
  const router = useRouter();
  const form = useSupplyForm(editSupply, "Supply details saved.", false, undefined, () =>
    router.refresh(),
  );
  return (
    <Card className="max-w-2xl p-5">
      <form onSubmit={form.submit}>
        <input type="hidden" name="supplyId" value={supply.id} />
        <input type="hidden" name="version" value={supply.version} />
        <fieldset disabled={form.pending} className="grid gap-4">
          <label className="grid gap-2 text-sm">
            Supply name
            <Input name="name" defaultValue={supply.name} required {...form.fieldError("name")} />
          </label>
          <label className="grid gap-2 text-sm">
            Unit name (e.g. kg, g, litre, box)
            <Input name="unit" defaultValue={supply.unit} required {...form.fieldError("unit")} />
          </label>
          <p className="text-muted-foreground text-sm">
            The stock unit tells the app how to measure this supply. For example, 1 kg is stored as
            1,000 g; taking 0.5 kg removes 500 g. Counted units such as boxes are counted
            individually. Older supplies need this confirmed before stock can be changed.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="countAsEntered" value="yes" className="mt-1" />
            Count each custom unit as one (for example, one bag). For an older custom unit, this
            also confirms how its existing stock is counted.
          </label>
          <p className="text-muted-foreground text-sm">
            Enter both quantities in the unit above. If changing kg to g, change 3 to 3,000 to keep
            the same stock. Weight, volume, and count cannot be exchanged for each other.
          </p>
          <label className="grid gap-2 text-sm">
            Stock quantity
            <Input
              name="stockQty"
              type="number"
              min="0"
              step="any"
              defaultValue={supply.stockQty}
              required
              {...form.fieldError("stockQty")}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Low-stock threshold
            <Input
              name="lowStockThreshold"
              type="number"
              min="0"
              step="any"
              defaultValue={supply.lowStockThreshold}
              required
              {...form.fieldError("lowStockThreshold")}
            />
          </label>
          {form.error ? (
            <p id={form.errorId} role="alert" className="text-destructive text-sm">
              {form.error.error}
            </p>
          ) : null}
          <Button type="submit">{form.pending ? "Saving…" : "Save supply"}</Button>
        </fieldset>
      </form>
    </Card>
  );
}
