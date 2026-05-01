import type { Metadata } from "next";
import CustomerOrderPage from "@/app/components/customer/CustomerOrderPage";

export const metadata: Metadata = {
  title: "Menu Ordering | Mash Allah Cafe",
  description: "Customer-facing animated cafe ordering screen.",
};

export default function MenuPage() {
  return <CustomerOrderPage />;
}
