import Link from "next/link";
import {
  AdminPage,
  Button,
  Card,
  DataTableCard,
  StatusBadge,
  Table,
  TableCell,
  TableHead,
} from "@/components/admin/shared";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { createSupplier, updateSupplier } from "./actions";

const fieldClass =
  "h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500";

function Fields({
  supplier,
}: {
  supplier?: {
    id: string;
    name: string;
    slug: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    isActive: boolean;
  };
}) {
  const activeInputId = supplier
    ? `supplier-${supplier.id}-active`
    : "new-supplier-active";

  return (
    <>
      {supplier ? <Input type="hidden" name="id" value={supplier.id} /> : null}
      <Input
        name="name"
        required
        defaultValue={supplier?.name}
        placeholder="Supplier name"
        className={fieldClass}
      />
      <Input
        name="slug"
        defaultValue={supplier?.slug}
        placeholder="supplier-slug"
        className={fieldClass}
      />
      <Input
        name="contactName"
        defaultValue={supplier?.contactName ?? ""}
        placeholder="Contact name"
        className={fieldClass}
      />
      <Input
        name="phone"
        defaultValue={supplier?.phone ?? ""}
        placeholder="Phone"
        className={fieldClass}
      />
      <Input
        name="email"
        type="email"
        defaultValue={supplier?.email ?? ""}
        placeholder="Business email"
        className={fieldClass}
      />
      <Input
        name="notes"
        defaultValue={supplier?.notes ?? ""}
        placeholder="Notes"
        className={fieldClass}
      />
      <Input type="hidden" name="isActive" value="false" />
      <label
        htmlFor={activeInputId}
        className="flex items-center gap-2 text-md font-semibold text-slate-700"
      >
        <Input
          id={activeInputId}
          type="checkbox"
          name="isActive"
          value="true"
          className="h-4 w-4 shrink-0"
          defaultChecked={supplier?.isActive ?? true}
        />
        Active
      </label>
    </>
  );
}

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { catalogItems: true, invoices: true, purchaseOrders: true },
      },
    },
  });

  return (
    <AdminPage
      title="Suppliers"
      description="Manage supplier contacts, catalogs, purchase orders, and invoice history."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/supplier-invoices">View supplier invoices</Link>
        </Button>
      }
    >
      <Card className="p-5">
        <h2 className="font-black">Add supplier</h2>
        <form
          action={createSupplier}
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <Fields />
          <Button className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">
            Create supplier
          </Button>
        </form>
      </Card>

      <DataTableCard>
        <Table>
          <thead>
            <tr>
              <TableHead>Supplier</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Invoices</TableHead>
              <TableHead>Purchase orders</TableHead>
              <TableHead>Catalog</TableHead>
              <TableHead>Edit</TableHead>
            </tr>
          </thead>
          <tbody>
            {suppliers.length ? (
              suppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-t border-slate-100 align-top"
                >
                  <TableCell>
                    <div className="font-black">{supplier.name}</div>
                    <div className="mt-1">
                      <StatusBadge active={supplier.isActive} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{supplier.contactName || "No contact name"}</div>
                    <div className="text-xs text-slate-500">
                      {supplier.phone || supplier.email || "No contact details"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">
                      {supplier._count.invoices} invoices
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      <Link
                        href={`/admin/supplier-invoices?supplier=${supplier.id}`}
                      >
                        View invoices
                      </Link>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">
                      {supplier._count.purchaseOrders} orders
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      <Link
                        href={`/admin/supplier-purchase-orders?supplier=${supplier.id}`}
                      >
                        View orders
                      </Link>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">
                      {supplier._count.catalogItems} items
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      <Link href={`/admin/suppliers/${supplier.id}`}>
                        Manage catalog
                      </Link>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <form
                      action={updateSupplier}
                      className="grid min-w-72 gap-2"
                    >
                      <Fields supplier={supplier} />
                      <Button
                        type="submit"
                        className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white"
                      >
                        Save changes
                      </Button>
                    </form>
                  </TableCell>
                </tr>
              ))
            ) : (
              <tr>
                <TableCell colSpan={6}>No suppliers have been added.</TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </DataTableCard>
    </AdminPage>
  );
}
