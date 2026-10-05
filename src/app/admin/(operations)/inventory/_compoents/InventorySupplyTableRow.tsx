import { Button, ToneBadge } from '@/components/admin/shared';
import { TableCell } from '@/components/ui/table';
import { canonicalUnitLabel } from '@/lib/inventory/inventory-domain';
import { InventoryStatus, InventorySupplyRow } from '@/types/admin/Inventory.types';
import { adjustSupplyInventory, updateSupplyInventory } from '../actions';
import { Input } from '@/components/ui/input';

function getTone(status: InventoryStatus) {
  if (status === "OUT") {
    return "red" as const;
  }

  if (status === "LOW") {
    return "amber" as const;
  }

  return "green" as const;
}


export default function InventorySupplyTableRow({ supply }: { supply: InventorySupplyRow }) {
  return (
    <tr className="border-b border-slate-50 align-top">
      <TableCell className="font-black text-slate-950">{supply.name}</TableCell>
      <TableCell>{supply.stockQty}</TableCell>
      <TableCell>
        {canonicalUnitLabel(supply.canonicalUnit)}
        {supply.quantityCoverage !== "COMPLETE" ? " (mapping required)" : ""}
      </TableCell>
      <TableCell>
        <ToneBadge tone={getTone(supply.status)}>
          {supply.status === "OK" ? "In Stock" : supply.status}
        </ToneBadge>
      </TableCell>
      <TableCell>
        <form action={updateSupplyInventory} className="flex min-w-60 gap-2">
          <Input type="hidden" name="supplyId" value={supply.id} />
          <Input
            name="stockQty"
            aria-label={`Stock quantity for ${supply.name}`}
            type="number"
            min="0"
            step="0.001"
            defaultValue={supply.stockQty}
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
          />
          <Input
            name="lowStockThreshold"
            aria-label={`Low stock threshold for ${supply.name}`}
            type="number"
            min="0"
            step="0.001"
            defaultValue={supply.lowStockThreshold}
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
          />
          <Button
            type="submit"
            className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"
          >
            Save
          </Button>
        </form>
      </TableCell>
      <TableCell>
        <form action={adjustSupplyInventory} className="flex min-w-56 gap-2">
          <Input type="hidden" name="supplyId" value={supply.id} />
          <Input
            name="quantity"
            aria-label={`Restock quantity for ${supply.name}`}
            type="number"
            min="1"
            placeholder="Qty"
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm"
          />
          <Input
            name="note"
            aria-label={`Restock note for ${supply.name}`}
            type="text"
            placeholder="Note"
            className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm"
          />
          <Button
            type="submit"
            className="h-9 rounded-lg border border-emerald-200 bg-emerald-900 px-3 text-xs font-bold text-white"
          >
            Add
          </Button>
        </form>
      </TableCell>
    </tr>
  );
}
