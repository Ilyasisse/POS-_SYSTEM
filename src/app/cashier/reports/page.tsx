import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

type CashierReportsPageProps = {
  searchParams?: Promise<{
    waiterId?: string;
    date?: string;
  }>;
};

export default async function CashierReportsPage({
  searchParams,
}: CashierReportsPageProps) {
  const currentUser = await requireRole(["CASHIER", "ADMIN"]);
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params?.waiterId) {
    query.set("waiterId", params.waiterId);
  }

  if (params?.date) {
    query.set("date", params.date);
  }

  if (currentUser.role === "ADMIN") {
    redirect(
      query.size > 0
        ? `/admin/reports?${query.toString()}`
        : "/admin/reports",
    );
  }

  redirect("/cashier");
}
