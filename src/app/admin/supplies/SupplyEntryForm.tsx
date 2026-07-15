"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SupplyFormAction = (formData: FormData) => void | Promise<void>;

function previewLineTotal(quantity: string, unitPrice: string) {
  const quantityMatch = quantity.match(/^(\d+)(?:\.(\d{0,3}))?$/);
  const priceMatch = unitPrice.match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!quantityMatch || !priceMatch) return "$0.00";

  const quantityThousands =
    Number(quantityMatch[1]) * 1000 +
    Number((quantityMatch[2] || "").padEnd(3, "0"));
  const priceCents =
    Number(priceMatch[1]) * 100 +
    Number((priceMatch[2] || "").padEnd(2, "0"));
  const lineCents = Math.floor((quantityThousands * priceCents + 500) / 1000);

  return `$${(lineCents / 100).toFixed(2)}`;
}

export function SupplyEntryFields({
  itemName = "",
  quantity = "",
  unitPrice = "",
  prefix,
}: {
  itemName?: string;
  quantity?: string;
  unitPrice?: string;
  prefix: string;
}) {
  const generatedId = useId();
  const [currentQuantity, setCurrentQuantity] = useState(quantity);
  const [currentUnitPrice, setCurrentUnitPrice] = useState(unitPrice);
  const itemNameId = `${prefix}-${generatedId}-name`;
  const quantityId = `${prefix}-${generatedId}-quantity`;
  const unitPriceId = `${prefix}-${generatedId}-price`;

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={itemNameId}>Item name</Label>
        <Input
          id={itemNameId}
          name="itemName"
          required
          defaultValue={itemName}
          placeholder="e.g. Milk"
          maxLength={160}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={quantityId}>Quantity</Label>
        <Input
          id={quantityId}
          name="quantity"
          type="number"
          min="0.001"
          step="0.001"
          required
          value={currentQuantity}
          onChange={(event) => setCurrentQuantity(event.target.value)}
          placeholder="0"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={unitPriceId}>Unit price</Label>
        <Input
          id={unitPriceId}
          name="unitPrice"
          type="number"
          min="0"
          step="0.01"
          required
          value={currentUnitPrice}
          onChange={(event) => setCurrentUnitPrice(event.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="grid gap-2">
        <Label>Line price</Label>
        <output
          aria-live="polite"
          className="flex h-8 items-center rounded-lg border bg-muted px-2.5 text-sm font-semibold tabular-nums"
        >
          {previewLineTotal(currentQuantity, currentUnitPrice)}
        </output>
      </div>
    </>
  );
}

export default function SupplyEntryForm({
  purchaseDate,
  action,
}: {
  purchaseDate: string;
  action: SupplyFormAction;
}) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_auto] xl:items-end">
      <Input type="hidden" name="purchaseDate" value={purchaseDate} />
      <SupplyEntryFields prefix="new-supply" />
      <Button type="submit">Add item</Button>
    </form>
  );
}
