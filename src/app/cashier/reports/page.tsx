import { redirect } from "next/navigation";

type CashierReportsRedirectProps = {
  searchParams?: Promise<{
    waiterId?: string;
    date?: string;
  }>;
};

export default async function CashierReportsRedirect({
  searchParams,
}: CashierReportsRedirectProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params?.waiterId) {
    query.set("waiterId", params.waiterId);
  }

  if (params?.date) {
    query.set("date", params.date);
  }

  redirect(
    query.size > 0 ? `/manager/reports?${query.toString()}` : "/manager/reports",
  );
}
