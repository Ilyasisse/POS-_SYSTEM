import MenuShowcase from "@/components/menu/MenuShowcase";
import type { MenuData } from "@/lib/menu/menu-data";

type MenuRouteWrapperProps = {
  data: MenuData;
};

/**
 * Bridges the menu route data fetch to the reusable menu showcase component.
 *
 * @param props - Menu route wrapper options.
 * @param props.data - Menu data loaded by the route.
 * @returns The rendered customer-facing menu showcase.
 *
 * @remarks Used by the public menu route.
 */
export default function MenuRouteWrapper({ data }: MenuRouteWrapperProps) {
  return <MenuShowcase data={data} />;
}
