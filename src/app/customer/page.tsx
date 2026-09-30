import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CustomerOrderPage from "@/components/customer/CustomerOrderPage";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDefaultRouteForUser } from "@/lib/auth/get-default-route-for-user";

export const metadata: Metadata = {
  title: "Customer Menu | Mash Allah Cafe",
  description: "Browse the live customer-facing menu.",
};

export default async function CustomerPage() {
  const user = await getCurrentUser();
  if (user && user.role !== "CUSTOMER") {
    redirect(getDefaultRouteForUser(user));
  }

  return (
    <CustomerOrderPage
      authState={!user ? "guest" : user.isActive ? "customer" : "blocked"}
    />
  );
}
