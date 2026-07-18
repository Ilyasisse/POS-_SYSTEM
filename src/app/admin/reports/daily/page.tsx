import { SalesReportPage, reportPermissions } from "@/components/admin/reports/SalesReportPage";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return SalesReportPage({ title: "Daily Report", description: "Paid sales for the 7 AM–5 AM Nairobi business day.", defaultPreset: "currentBusinessDay", permission: reportPermissions.daily, searchParams });
}
