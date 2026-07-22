"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createSupplierCatalogItem } from "./actions";

type CatalogCandidate = {
  id: string;
  name: string;
  suggestedUnit: string;
};

export default function CatalogItemCreateForm({
  supplierId,
  products,
  supplies,
}: {
  supplierId: string;
  products: CatalogCandidate[];
  supplies: CatalogCandidate[];
}) {
  const generatedId = useId();
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("unit");
  const candidates = useMemo(
    () => [
      ...products.map((item) => ({ ...item, value: `product:${item.id}` })),
      ...supplies.map((item) => ({ ...item, value: `supply:${item.id}` })),
    ],
    [products, supplies],
  );

  return (
    <form
      action={createSupplierCatalogItem}
      className="grid gap-4 lg:grid-cols-[minmax(15rem,1.5fr)_0.7fr_0.7fr_auto] lg:items-end"
    >
      <Input type="hidden" name="supplierId" value={supplierId} />
      <div className="grid gap-2">
        <Label htmlFor={`${generatedId}-target`}>Product or supply</Label>
        <NativeSelect
          id={`${generatedId}-target`}
          name="target"
          required
          value={target}
          onChange={(event) => {
            const nextTarget = event.target.value;
            setTarget(nextTarget);
            const candidate = candidates.find((item) => item.value === nextTarget);
            setUnit(candidate?.suggestedUnit || "unit");
          }}
          className="w-full"
        >
          <option value="" disabled>
            Select an item
          </option>
          {products.length ? (
            <optgroup label="Products">
              {products.map((item) => (
                <option key={item.id} value={`product:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {supplies.length ? (
            <optgroup label="Inventory supplies">
              {supplies.map((item) => (
                <option key={item.id} value={`supply:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${generatedId}-unit`}>Purchasing unit</Label>
        <Input
          id={`${generatedId}-unit`}
          name="unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          maxLength={40}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${generatedId}-price`}>Current unit price</Label>
        <Input
          id={`${generatedId}-price`}
          name="unitPrice"
          type="number"
          min="0"
          max="9999999999.99"
          step="0.01"
          placeholder="0.00"
          required
        />
      </div>
      <div className="flex flex-col gap-3">
        <Input type="hidden" name="isActive" value="false" />
        <label className="flex items-center gap-2 text-sm font-medium">
          <Input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked
            className="size-4"
          />
          Active
        </label>
        <Button type="submit" disabled={!products.length && !supplies.length}>
          Add catalog item
        </Button>
      </div>
    </form>
  );
}
