import { SalesReportPage, reportPermissions } from "@/components/admin/reports/SalesReportPage";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return SalesReportPage({ title: "Sales and Orders", description: "Recognized revenue, adjustments, payments, and paid-order detail.", defaultPreset: "currentBusinessDay", permission: reportPermissions.daily, searchParams, focus: "orders" });
}
