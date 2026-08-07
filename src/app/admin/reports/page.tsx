import { SalesReportPage } from "@/components/admin/reports/SalesReportPage";
import { reportPermissions } from "@/lib/reports/report-permissions";

export const dynamic = "force-dynamic";

export default function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SalesReportPage({
    title: "Business Intelligence",
    description: "Authoritative café sales and operational reporting.",
    defaultPreset: "currentBusinessDay",
    permission: reportPermissions.daily,
    searchParams,
  });
}
