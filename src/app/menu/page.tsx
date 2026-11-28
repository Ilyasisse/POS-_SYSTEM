import type { Metadata } from "next";
import { Suspense } from "react";
import MenuRouteWrapper from "./_components/MenuRouteWrapper";
import MenuChrome from "./_components/MenuChrome";
import MenuHero from "./_components/MenuHero";
import MenuFooter from "./_components/MenuFooter";
import MenuProductsLoading from "./_components/MenuProductsLoading";
import { MENU_CAFE_NAME, MENU_HERO_IMAGE } from "@/lib/menu/menu-config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Menu | Maash Allah Cafe",
  description:
    "Find your next favorite at Maash Allah Cafe in Bosaso. Explore our menu of fresh meals, coffee, and refreshing drinks, with prices to help you choose.",

  icons: {
    icon: {
      url: "/menu-icon.png",
      sizes: "64x64",
      type: "image/png",
    },
  },

  openGraph: {
    title: "Menu | Maash Allah Cafe",
    description:
      "Find your next favorite at Maash Allah Cafe in Bosaso. Explore our menu of fresh meals, coffee, and refreshing drinks, with prices to help you choose.",
    siteName: "Maash Allah Cafe",
    type: "website",
  },
};
export default function MenuPage() {
  return (
    <main className="text-foreground dark:bg-background dark:text-foreground min-h-screen bg-[#f7efe6]">
      <MenuChrome cafeName={MENU_CAFE_NAME} />
      <MenuHero heroImage={MENU_HERO_IMAGE} />
      <Suspense fallback={<MenuProductsLoading />}>
        <MenuRouteWrapper />
      </Suspense>
      <MenuFooter cafeName={MENU_CAFE_NAME} />
    </main>
  );
}
