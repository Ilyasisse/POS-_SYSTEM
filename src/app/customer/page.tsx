import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CustomerOrderPage from "@/app/components/customer/CustomerOrderPage";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Customer Menu | Mash Allah Cafe",
  description: "Browse the live customer-facing menu.",
};

export default async function CustomerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=customer-login-required");
  }

  return <CustomerOrderPage />;
}
