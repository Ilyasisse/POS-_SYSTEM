"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [
  ["Directory", "/admin/suppliers"],
  ["Purchase orders", "/admin/supplier-purchase-orders"],
  ["Invoices", "/admin/supplier-invoices"],
  ["Bills & payments", "/admin/reports/supplier-bills"],
  ["Schedules", "/admin/supplier-order-schedules"],
];
export default function SupplierNavigation() {
  const path = usePathname();
  return (
    <nav aria-label="Supplier workspace" className="flex flex-wrap gap-2 border-b p-4 sm:px-8">
      {links.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href || path.startsWith(href + "/") ? "page" : undefined}
          className="hover:bg-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
