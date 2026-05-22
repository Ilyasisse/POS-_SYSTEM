import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

type ManagerReportsPageProps = {
  searchParams?: Promise<{
    waiterId?: string;
    date?: string;
  }>;
};

export default async function ManagerReportsPage({
  searchParams,
}: ManagerReportsPageProps) {
  await requireRole(["MANAGER", "ADMIN"]);

  const params = await searchParams;
  const query = new URLSearchParams();

  if (params?.waiterId) {
    query.set("waiterId", params.waiterId);
  }

  if (params?.date) {
    query.set("date", params.date);
  }

  redirect(
    query.size > 0 ? `/admin/reports?${query.toString()}` : "/admin/reports",
  );
}
