import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import {
  AdminCard,
  AdminPageFrame,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  StatusBadge,
} from "@/components/admin/AdminUi";
import { prisma } from "@/lib/prisma";
import { createSupplier, updateSupplier } from "./actions";

const fieldClass = "h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500";

function Fields({ supplier }: { supplier?: {
  id: string; name: string; slug: string; contactName: string | null; phone: string | null;
  email: string | null; googleEmail: string | null; notes: string | null; isActive: boolean;
} }) {
  return (
    <>
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
      <input name="name" required defaultValue={supplier?.name} placeholder="Supplier name" className={fieldClass} />
      <input name="slug" defaultValue={supplier?.slug} placeholder="portal-slug" className={fieldClass} />
      <input name="contactName" defaultValue={supplier?.contactName ?? ""} placeholder="Contact name" className={fieldClass} />
      <input name="phone" defaultValue={supplier?.phone ?? ""} placeholder="Phone" className={fieldClass} />
      <input name="email" type="email" defaultValue={supplier?.email ?? ""} placeholder="Business email" className={fieldClass} />
      <input name="googleEmail" type="email" defaultValue={supplier?.googleEmail ?? ""} placeholder="Assigned Google email" className={fieldClass} />
      <input name="notes" defaultValue={supplier?.notes ?? ""} placeholder="Notes" className={fieldClass} />
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="hidden" name="isActive" value="false" />
        <input type="checkbox" name="isActive" value="true" defaultChecked={supplier?.isActive ?? true} /> Active
      </label>
    </>
  );
}

export default async function SuppliersPage() {
  const [suppliers, requestHeaders] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { deliveries: true } } } }),
    headers(),
  ]);
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const rows = await Promise.all(suppliers.map(async (supplier) => {
    const portalUrl = `${protocol}://${host}/supplier/${supplier.slug}`;
    return { supplier, portalUrl, qrUrl: await QRCode.toDataURL(portalUrl, { width: 180, margin: 1 }) };
  }));

  return (
    <AdminPageFrame title="Suppliers" description="Manage supplier contacts, assigned Google accounts, and delivery portal links.">
      <AdminCard className="p-5">
        <h2 className="font-black">Add supplier</h2>
        <form action={createSupplier} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Fields />
          <button className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">Create supplier</button>
        </form>
      </AdminCard>

      <AdminTableShell>
        <AdminTable>
          <thead><tr><AdminTh>Supplier</AdminTh><AdminTh>Portal</AdminTh><AdminTh>Account</AdminTh><AdminTh>Deliveries</AdminTh><AdminTh>Edit</AdminTh></tr></thead>
          <tbody>
            {rows.length ? rows.map(({ supplier, portalUrl, qrUrl }) => (
              <tr key={supplier.id} className="border-t border-slate-100 align-top">
                <AdminTd><div className="font-black">{supplier.name}</div><div className="mt-1"><StatusBadge active={supplier.isActive} /></div></AdminTd>
                <AdminTd>
                  <Image src={qrUrl} alt={`${supplier.name} QR code`} width={90} height={90} unoptimized />
                  <Link href={portalUrl} target="_blank" className="mt-1 block max-w-48 break-all text-xs font-bold text-blue-600">{portalUrl}</Link>
                </AdminTd>
                <AdminTd><div>{supplier.googleEmail || "Not assigned"}</div><div className="text-xs text-slate-500">{supplier.phone || supplier.email || "No contact"}</div></AdminTd>
                <AdminTd>{supplier._count.deliveries}</AdminTd>
                <AdminTd>
                  <form action={updateSupplier} className="grid min-w-72 gap-2">
                    <Fields supplier={supplier} />
                    <button className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white">Save changes</button>
                  </form>
                </AdminTd>
              </tr>
            )) : <tr><AdminTd colSpan={5}>No suppliers have been added.</AdminTd></tr>}
          </tbody>
        </AdminTable>
      </AdminTableShell>
    </AdminPageFrame>
  );
}
