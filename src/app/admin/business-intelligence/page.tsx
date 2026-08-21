import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

const reportCards = [
  ["Sales", "/api/admin/reports/sales", PERMISSIONS.REPORT_DAILY_VIEW],
  ["Inventory & waste", "/api/admin/reports/inventory", PERMISSIONS.REPORT_INVENTORY_VIEW],
  ["Kitchen", "/api/admin/reports/kitchen", PERMISSIONS.REPORT_KITCHEN_VIEW],
  ["Staff", "/api/admin/reports/staff", PERMISSIONS.REPORT_STAFF_VIEW],
  ["Customers", "/api/admin/reports/customers", PERMISSIONS.REPORT_CUSTOMER_VIEW],
  ["Suppliers", "/api/admin/reports/suppliers", PERMISSIONS.REPORT_SUPPLIER_VIEW],
  ["Finance", "/api/admin/reports/finance", PERMISSIONS.REPORT_FINANCIAL_VIEW],
  ["Operations", "/api/admin/reports/operations", PERMISSIONS.REPORT_OPERATIONS_VIEW],
] as const;

export default async function BusinessIntelligencePage() {
  const user = await requirePermission(PERMISSIONS.REPORT_VIEW);
  return <main className="space-y-6 p-4 md:p-8"><header><h1 className="text-2xl font-semibold">Business intelligence</h1><p className="text-sm text-muted-foreground">Live server-calculated reports. Coverage notes mark periods that were not historically recorded.</p></header><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{reportCards.filter(([, , permission]) => hasPermission(user, permission)).map(([name, href]) => <Link key={name} href={href} className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2"><h2 className="font-medium">{name}</h2><p className="mt-1 text-sm text-muted-foreground">Open JSON report or export with authorized filters.</p></Link>)}</section><section className="rounded-lg border p-4 text-sm"><h2 className="font-medium">Operational controls</h2><p className="mt-1 text-muted-foreground">Attendance, payroll, expenses, supplier receiving, feedback, and complaints are recorded as audited source data; anonymous orders remain anonymous.</p></section></main>;
}
