import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDefaultRouteForUser } from "@/lib/auth/get-default-route-for-user";
import CustomerCheckoutPageClient from "@/components/customer/CustomerCheckoutPageClient";

export default async function CustomerCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect(getDefaultRouteForUser(user));
  const { id } = await params;
  return <CustomerCheckoutPageClient checkoutId={id} />;
}
