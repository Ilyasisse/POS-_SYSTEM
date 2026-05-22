import { redirect } from "next/navigation";

type CashierWaiterOrdersRedirectProps = {
  searchParams?: Promise<{
    waiterId?: string;
  }>;
};

export default async function CashierWaiterOrdersRedirect({
  searchParams,
}: CashierWaiterOrdersRedirectProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params?.waiterId) {
    query.set("waiterId", params.waiterId);
  }

  redirect(
    query.size > 0
      ? `/manager/waiter-orders?${query.toString()}`
      : "/manager/waiter-orders",
  );
}
