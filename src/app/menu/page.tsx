import type { Metadata } from "next";
import MenuRouteWrapper from "./_components/MenuRouteWrapper";
import { getMenuData } from "@/lib/menu/menu-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu | MaashAllah Cafe",
  description: "Customer-facing cafe menu with live POS products.",
};

export default async function MenuPage() {
  const data = await getMenuData();

  return <MenuRouteWrapper data={data} />;
}
