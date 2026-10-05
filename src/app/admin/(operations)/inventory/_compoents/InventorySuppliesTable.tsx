import {
  DataTableCard,
  SearchToolbar,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { InventorySupplyRow } from "@/types/admin/Inventory.types";

import InventorySupplyTableRow from "./InventorySupplyTableRow";

export default function InventorySuppliesTable({
  visibleSupplies,
  totalSupplies,
  searchQuery,
  statusFilter,
}: {
  visibleSupplies: InventorySupplyRow[];
  totalSupplies: number;
  searchQuery: string;
  statusFilter: string;
}) {
  return (
    <DataTableCard
      footer={
        <p className="text-sm font-medium text-muted-foreground">
          Showing 1 to {visibleSupplies.length} of {totalSupplies} items
        </p>
      }
    >
      <SearchToolbar
        placeholder="Search inventory..."
        defaultValue={searchQuery}
        hasActiveFilters={Boolean(searchQuery || statusFilter !== "all")}
        clearHref="/admin/inventory"
      >
        <AutoSubmitSelect name="status" defaultValue={statusFilter}>
          <option value="all">Status All</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </AutoSubmitSelect>
      </SearchToolbar>
      <Table>
        <thead>
          <tr>
            <TableHead>Item</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Set Stock</TableHead>
            <TableHead>Restock</TableHead>
          </tr>
        </thead>
        <tbody>
          {visibleSupplies.length === 0 ? (
            <tr>
              <TableCell colSpan={7} className="py-10 text-center">
                No inventory supplies found.
              </TableCell>
            </tr>
          ) : (
            visibleSupplies.map((supply) => (
              <InventorySupplyTableRow key={supply.id} supply={supply} />
            ))
          )}
        </tbody>
      </Table>
    </DataTableCard>
  );
}
