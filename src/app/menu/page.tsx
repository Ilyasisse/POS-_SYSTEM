import type { Metadata } from "next";
import MenuShowcase from "./MenuShowcase";
import { getMenuData } from "./menu-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu | Maash Allah Cafe",
  description: "Customer-facing cafe menu with live POS products and graceful fallbacks.",
};

export default async function MenuPage() {
  const data = await getMenuData();

  return <MenuShowcase data={data} />;
}
