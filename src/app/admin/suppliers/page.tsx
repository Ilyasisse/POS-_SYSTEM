import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Card,
  AdminPage,
  Table,
  DataTableCard,
  TableCell,
  TableHead,
  StatusBadge,
} from "@/components/admin/shared";
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
    googleEmail: string | null;
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
        placeholder="portal-slug"
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
        name="googleEmail"
        type="email"
        defaultValue={supplier?.googleEmail ?? ""}
        placeholder="Assigned Google email"
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
  const [suppliers, requestHeaders] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { catalogItems: true, deliveries: true } },
      },
    }),
    headers(),
  ]);
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  const rows = await Promise.all(
    suppliers.map(async (supplier) => {
      const portalUrl = `${protocol}://${host}/supplier/${supplier.slug}`;
      return {
        supplier,
        portalUrl,
        qrUrl: await QRCode.toDataURL(portalUrl, { width: 180, margin: 1 }),
      };
    }),
  );

  return (
    <AdminPage
      title="Suppliers"
      description="Manage supplier contacts, assigned Google accounts, and delivery portal links."
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
              <TableHead>Portal</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Deliveries</TableHead>
              <TableHead>Catalog</TableHead>
              <TableHead>Edit</TableHead>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map(({ supplier, portalUrl, qrUrl }) => (
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
                    <Image
                      src={qrUrl}
                      alt={`${supplier.name} QR code`}
                      width={90}
                      height={90}
                      unoptimized
                    />
                    <Link
                      href={portalUrl}
                      target="_blank"
                      className="mt-1 block max-w-48 break-all text-xs font-bold text-blue-600"
                    >
                      {portalUrl}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{supplier.googleEmail || "Not assigned"}</div>
                    <div className="text-xs text-slate-500">
                      {supplier.phone || supplier.email || "No contact"}
                    </div>
                  </TableCell>
                  <TableCell>{supplier._count.deliveries}</TableCell>
                  <TableCell>
                    <div className="font-semibold">
                      {supplier._count.catalogItems} items
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-2">
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
                      <Button type="submit" className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white">
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
