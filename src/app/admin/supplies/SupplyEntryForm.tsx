"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

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
  catalogItems,
  catalogItemId = "",
  quantity = "",
  unitPrice = "",
  prefix,
}: {
  catalogItems: SupplyCatalogOption[];
  catalogItemId?: string;
  quantity?: string;
  unitPrice?: string;
  prefix: string;
}) {
  const generatedId = useId();
  const initialItem = catalogItems.find((item) => item.id === catalogItemId);
  const [currentCatalogItemId, setCurrentCatalogItemId] = useState(
    catalogItemId || catalogItems[0]?.id || "",
  );
  const [currentQuantity, setCurrentQuantity] = useState(quantity || "1");
  const [currentUnitPrice, setCurrentUnitPrice] = useState(
    unitPrice || initialItem?.defaultUnitPrice || catalogItems[0]?.defaultUnitPrice || "",
  );
  const [priceOverride, setPriceOverride] = useState(
    Boolean(unitPrice && initialItem && unitPrice !== initialItem.defaultUnitPrice),
  );
  const selectedItem = catalogItems.find((item) => item.id === currentCatalogItemId);
  const itemNameId = `${prefix}-${generatedId}-name`;
  const quantityId = `${prefix}-${generatedId}-quantity`;
  const unitPriceId = `${prefix}-${generatedId}-price`;

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={itemNameId}>Supply item</Label>
        <NativeSelect
          id={itemNameId}
          name="catalogItemId"
          required
          value={currentCatalogItemId}
          className="w-full"
          onChange={(event) => {
            const nextId = event.target.value;
            const nextItem = catalogItems.find((item) => item.id === nextId);
            setCurrentCatalogItemId(nextId);
            setCurrentUnitPrice(nextItem?.defaultUnitPrice ?? "");
            setPriceOverride(false);
          }}
        >
          <option value="" disabled>Select an item</option>
          {catalogItems.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>
          ))}
        </NativeSelect>
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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={unitPriceId}>Unit price</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (priceOverride) {
                setCurrentUnitPrice(selectedItem?.defaultUnitPrice ?? "");
              }
              setPriceOverride((current) => !current);
            }}
          >
            {priceOverride ? "Use catalog price" : "Change price once"}
          </Button>
        </div>
        <Input
          id={unitPriceId}
          name="unitPrice"
          type="number"
          min="0"
          step="0.01"
          required
          readOnly={!priceOverride}
          value={currentUnitPrice}
          onChange={(event) => setCurrentUnitPrice(event.target.value)}
          placeholder="0.00"
        />
        <p className="text-xs text-muted-foreground">
          {priceOverride
            ? "This price applies only to this purchase."
            : `Catalog price per ${selectedItem?.unit ?? "unit"}.`}
        </p>
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
  catalogItems,
}: {
  purchaseDate: string;
  action: SupplyFormAction;
  catalogItems: SupplyCatalogOption[];
}) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_auto] xl:items-end">
      <Input type="hidden" name="purchaseDate" value={purchaseDate} />
      <SupplyEntryFields prefix="new-supply" catalogItems={catalogItems} />
      <Button type="submit" disabled={catalogItems.length === 0}>Add item</Button>
    </form>
  );
}

export type SupplyCatalogOption = {
  id: string;
  name: string;
  unit: string;
  defaultUnitPrice: string;
};
