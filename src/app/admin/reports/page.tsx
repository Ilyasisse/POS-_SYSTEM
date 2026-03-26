import WaiterBalanceReportPage from "@/app/components/reports/WaiterBalanceReportPage";
import { requireRole } from "@/lib/auth/requireRole";

type AdminReportsPageProps = {
  searchParams?: Promise<{
    waiterId?: string;
    date?: string;
  }>;
};

export default async function AdminReportsPage({
  searchParams,
}: AdminReportsPageProps) {
  const currentUser = await requireRole(["ADMIN", "MANAGER"]);
  const params = await searchParams;

  return (
    <WaiterBalanceReportPage
      currentUserName={currentUser.fullName}
      dashboardHref="/admin"
      dashboardLabel="Back to Admin"
      searchParams={params}
    />
  );
}
