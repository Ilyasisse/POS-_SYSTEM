import { SalesReportPage } from "@/components/admin/reports/SalesReportPage";
import { reportPermissions } from "@/lib/reports/report-permissions";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return SalesReportPage({ title: "Weekly Report", description: "Saturday-start weekly sales and product performance.", defaultPreset: "thisWeek", permission: reportPermissions.weekly, searchParams });
}
