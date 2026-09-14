import { SalesReportPage } from "@/components/admin/reports/SalesReportPage";
import { reportPermissions } from "@/lib/reports/report-permissions";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return SalesReportPage({ title: "Monthly Sales", description: "Calendar-month sales using café business dates.", defaultPreset: "thisMonth", permission: reportPermissions.monthly, searchParams });
}
