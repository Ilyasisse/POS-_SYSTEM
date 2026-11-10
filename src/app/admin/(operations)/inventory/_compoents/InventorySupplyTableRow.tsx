"use client";

import { Button, ToneBadge } from "@/components/admin/shared";
import { TableCell } from "@/components/ui/table";
import type { InventoryStatus, InventorySupplyRow } from "@/types/admin/Inventory.types";
import { Input } from "@/components/ui/input";
import { adjustSupplyInventory, updateSupplyInventory } from "../actions";
import { useSupplyForm } from "./useSupplyForm";

function getTone(status: InventoryStatus) {
  if (status === "OUT") return "red";
  if (status === "LOW") return "amber";
  return "green";
}

function StockEditForm({ supply }: { supply: InventorySupplyRow }) {
  const { submit, pending, error, errorId, fieldError } = useSupplyForm(
    updateSupplyInventory,
    "Stock settings saved.",
  );
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="flex min-w-60 gap-2">
        <input type="hidden" name="supplyId" value={supply.id} />
        <input type="hidden" name="stockUnit" value={supply.stockUnit} />
        <Input
          name="stockQty"
          aria-label={"Stock quantity for " + supply.name + " (" + supply.unit + ")"}
          {...fieldError("stockQty")}
          type="number"
          min="0"
          step={supply.step}
          defaultValue={supply.stockQty}
          className="h-9 w-20"
          required
        />
        <Input
          name="lowStockThreshold"
          aria-label={"Low-stock threshold for " + supply.name + " (" + supply.unit + ")"}
          {...fieldError("lowStockThreshold")}
          type="number"
          min="0"
          step={supply.step}
          defaultValue={supply.lowStockThreshold}
          className="h-9 w-20"
          required
        />
        <Button type="submit" className="h-9">
          {pending ? "Saving…" : "Save"}
        </Button>
      </fieldset>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive mt-2 text-xs">
          {error.error}
        </p>
      ) : null}
    </form>
  );
}

function RestockForm({ supply }: { supply: InventorySupplyRow }) {
  const { submit, pending, error, errorId, fieldError } = useSupplyForm(
    adjustSupplyInventory,
    "Supply restocked.",
    true,
  );
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="flex min-w-56 gap-2">
        <input type="hidden" name="supplyId" value={supply.id} />
        <input type="hidden" name="stockUnit" value={supply.stockUnit} />
        <Input
          name="quantity"
          aria-label={"Restock quantity for " + supply.name + " (" + supply.unit + ")"}
          {...fieldError("quantity")}
          type="number"
          min={supply.step}
          step={supply.step}
          placeholder={supply.unit}
          className="h-9 w-20"
          required
        />
        <Input
          name="note"
          aria-label={"Restock note for " + supply.name}
          type="text"
          placeholder="Note"
          className="h-9 w-24"
        />
        <Button type="submit" className="h-9 bg-emerald-900 text-white hover:bg-emerald-900/90">
          {pending ? "Adding…" : "Add"}
        </Button>
      </fieldset>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive mt-2 text-xs">
          {error.error}
        </p>
      ) : null}
    </form>
  );
}

export default function InventorySupplyTableRow({ supply }: { supply: InventorySupplyRow }) {
  return (
    <tr className="border-border border-b align-top">
      <TableCell className="text-muted-foreground font-bold">{supply.name}</TableCell>
      <TableCell>{supply.stockQty}</TableCell>
      <TableCell>{supply.unit}</TableCell>
      <TableCell>
        <ToneBadge tone={getTone(supply.status)}>
          {supply.status === "OK" ? "In Stock" : supply.status}
        </ToneBadge>
      </TableCell>
      {supply.hasUnitMapping ? (
        <>
          <TableCell>
            <StockEditForm
              key={JSON.stringify([supply.stockUnit, supply.stockQty, supply.lowStockThreshold])}
              supply={supply}
            />
          </TableCell>
          <TableCell>
            <RestockForm key={supply.stockUnit} supply={supply} />
          </TableCell>
        </>
      ) : (
        <TableCell colSpan={2}>
          <p className="text-muted-foreground text-sm">
            Configure the stock unit before editing or restocking this supply.
          </p>
        </TableCell>
      )}
    </tr>
  );
}
