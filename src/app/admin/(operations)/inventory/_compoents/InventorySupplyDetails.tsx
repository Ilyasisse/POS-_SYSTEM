"use client";

import { stockLabels } from "@/components/inventory/stock-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InventorySupplyRow } from "@/types/admin/Inventory.types";
import type { adjustSupplyInventory, updateSupplyInventory } from "../actions";
import { useSupplyForm } from "./useSupplyForm";

type StockFormProps = {
  supply: InventorySupplyRow;
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
  onSuccess: () => void;
};

function StockEditForm({
  supply,
  pending,
  onPendingChange,
  onSuccess,
  action,
}: StockFormProps & { action: typeof updateSupplyInventory }) {
  const form = useSupplyForm(action, "Stock settings saved.", false, onPendingChange, onSuccess);
  return (
    <form onSubmit={form.submit} className="rounded-2xl border p-4">
      <h4 className="mb-3 text-sm font-semibold">Set stock</h4>
      <fieldset disabled={pending} className="grid gap-3">
        <input type="hidden" name="supplyId" value={supply.id} />
        <input type="hidden" name="stockUnit" value={supply.stockUnit} />
        <label className="grid gap-1.5 text-sm">
          Stock quantity ({supply.unit})
          <Input
            name="stockQty"
            {...form.fieldError("stockQty")}
            type="number"
            inputMode="decimal"
            min="0"
            step={supply.step}
            defaultValue={supply.stockQty}
            required
          />
          {form.error?.field === "stockQty" ? (
            <span id={form.errorId} role="alert" className="text-destructive text-xs">
              {form.error.error}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1.5 text-sm">
          Low-stock threshold ({supply.unit})
          <Input
            name="lowStockThreshold"
            {...form.fieldError("lowStockThreshold")}
            type="number"
            inputMode="decimal"
            min="0"
            step={supply.step}
            defaultValue={supply.lowStockThreshold}
            required
          />
          {form.error?.field === "lowStockThreshold" ? (
            <span id={form.errorId} role="alert" className="text-destructive text-xs">
              {form.error.error}
            </span>
          ) : null}
        </label>
        <Button type="submit" variant="outline" className="rounded-full">
          {form.pending ? "Saving…" : "Save stock"}
        </Button>
      </fieldset>
    </form>
  );
}

function RestockForm({
  supply,
  pending,
  onPendingChange,
  onSuccess,
  action,
}: StockFormProps & { action: typeof adjustSupplyInventory }) {
  const form = useSupplyForm(action, "Supply restocked.", false, onPendingChange, onSuccess);
  return (
    <form onSubmit={form.submit} className="rounded-2xl border p-4">
      <h4 className="mb-3 text-sm font-semibold">Restock</h4>
      <fieldset disabled={pending} className="grid gap-3">
        <input type="hidden" name="supplyId" value={supply.id} />
        <input type="hidden" name="stockUnit" value={supply.stockUnit} />
        <label className="grid gap-1.5 text-sm">
          Restock quantity ({supply.unit})
          <Input
            name="quantity"
            {...form.fieldError("quantity")}
            type="number"
            inputMode="decimal"
            min={supply.step}
            step={supply.step}
            required
          />
          {form.error ? (
            <span id={form.errorId} role="alert" className="text-destructive text-xs">
              {form.error.error}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1.5 text-sm">
          Note (optional)
          <Input name="note" type="text" />
        </label>
        <Button type="submit" className="rounded-full">
          {form.pending ? "Adding…" : "Add stock"}
        </Button>
      </fieldset>
    </form>
  );
}

export default function InventorySupplyDetails({
  supply,
  pending,
  onPendingChange,
  onClear,
  updateStock,
  restock,
}: Omit<StockFormProps, "onSuccess"> & {
  onClear: () => void;
  updateStock: typeof updateSupplyInventory;
  restock: typeof adjustSupplyInventory;
}) {
  const formProps = { supply, pending, onPendingChange, onSuccess: onClear };
  return (
    <div className="grid gap-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold wrap-break-word">{supply.name}</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {supply.stockQty} {supply.unit} on hand · {stockLabels[supply.status]}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-full"
          disabled={pending}
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
      {supply.hasUnitMapping ? (
        <>
          <RestockForm {...formProps} action={restock} />
          <StockEditForm {...formProps} action={updateStock} />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Configure the stock unit before editing or restocking this supply.
        </p>
      )}
    </div>
  );
}
