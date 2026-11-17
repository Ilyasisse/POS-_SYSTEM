import MenuShowcase from "@/components/menu/MenuShowcase";
import { getMenuData } from "@/lib/menu/menu-data";
export default async function MenuRouteWrapper() {
  const data = await getMenuData();
  return <MenuShowcase data={data} />;
}
