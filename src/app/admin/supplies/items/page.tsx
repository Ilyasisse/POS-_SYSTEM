import Link from "next/link";
import { Archive, ArrowLeft, RotateCcw } from "lucide-react";
import { AdminPage, Button, Card, DataTableCard, Table, TableCell, TableHead } from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { createSupplyCatalogItem, setSupplyCatalogItemActive, updateSupplyCatalogItem } from "./actions";

export default async function SupplyItemsPage() {
  await requirePermission(PERMISSIONS.SUPPLY_MANAGE);
  const items = await prisma.supplyCatalogItem.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }, { unit: "asc" }] });

  return <AdminPage title="Supply items" description="Create reusable supply defaults. Daily purchases can change the price once without changing this catalog.">
    <div><Button asChild variant="outline"><Link href="/admin/supplies"><ArrowLeft className="size-4" />Back to daily supplies</Link></Button></div>
    <Card className="p-5">
      <h2 className="font-black">Add supply item</h2>
      <form action={createSupplyCatalogItem} className="mt-4 grid gap-3 md:grid-cols-[1fr_10rem_10rem_auto] md:items-end">
        <div className="grid gap-1"><Label htmlFor="catalog-name">Name</Label><Input id="catalog-name" name="name" required maxLength={160} placeholder="Milk" /></div>
        <div className="grid gap-1"><Label htmlFor="catalog-unit">Unit</Label><Input id="catalog-unit" name="unit" required maxLength={40} placeholder="kg or box" /></div>
        <div className="grid gap-1"><Label htmlFor="catalog-price">Default price</Label><Input id="catalog-price" name="defaultUnitPrice" type="number" min="0" step="0.0001" required /></div>
        <Button>Add item</Button>
      </form>
    </Card>
    <DataTableCard>
      <Table><thead><tr><TableHead>Item</TableHead><TableHead>Unit</TableHead><TableHead>Default price</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></tr></thead>
        <tbody>{items.length ? items.map((item) => {
          const updateFormId = `update-supply-item-${item.id}`;
          return <tr key={item.id} className="border-t">
            <TableCell><Input form={updateFormId} name="name" defaultValue={item.name} required maxLength={160} aria-label={`Name for ${item.name}`} disabled={!item.isActive} /></TableCell>
            <TableCell><Input form={updateFormId} name="unit" defaultValue={item.unit} required maxLength={40} aria-label={`Unit for ${item.name}`} disabled={!item.isActive} /></TableCell>
            <TableCell><Input form={updateFormId} name="defaultUnitPrice" type="number" min="0" step="0.0001" defaultValue={item.defaultUnitPrice.toString()} required aria-label={`Default price for ${item.name}`} disabled={!item.isActive} /></TableCell>
            <TableCell><span className="text-sm font-medium">{item.isActive ? "Active" : "Archived"}</span></TableCell>
            <TableCell><div className="flex gap-2">
              <form id={updateFormId} action={updateSupplyCatalogItem}><Input type="hidden" name="id" value={item.id} /></form>
              {item.isActive ? <Button form={updateFormId} size="sm">Save</Button> : null}
              <form action={setSupplyCatalogItemActive}><Input type="hidden" name="id" value={item.id} /><Input type="hidden" name="active" value={String(!item.isActive)} /><Button size="sm" variant="outline">{item.isActive ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}{item.isActive ? "Archive" : "Restore"}</Button></form>
            </div></TableCell>
          </tr>;
        }) : <tr><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No catalog items yet.</TableCell></tr>}</tbody>
      </Table>
      <p className="p-4 text-sm text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"} · Active prices are defaults; one-time changes are made during daily entry.</p>
    </DataTableCard>
  </AdminPage>;
}
