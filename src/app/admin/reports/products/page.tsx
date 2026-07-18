import { SalesReportPage, reportPermissions } from "@/components/admin/reports/SalesReportPage";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return SalesReportPage({ title: "Product Performance", description: "Product sales, volume, cost coverage, and estimated profit.", defaultPreset: "currentBusinessDay", permission: reportPermissions.daily, searchParams, focus: "products" });
}
