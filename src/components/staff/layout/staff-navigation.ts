import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  PackageSearch,
  ReceiptText,
  Shirt,
  Store,
  Users,
  UtensilsCrossed,
  ChefHat,
  Coffee,
} from "lucide-react";
import type { Station } from "@prisma/client";

import {
  PERMISSIONS,
  canAccessStation,
  hasPermission,
  type Permission,
  type PermissionUser,
} from "@/lib/auth/permissions";
import type { AdminNavCounts } from "@/components/admin/layout/admin-navigation";
import { adminNavigationItems } from "@/components/admin/layout/admin-navigation";

export type StaffNavigationSection = "admin" | "operations" | "kitchen";
export type StaffNavigationScope = "all" | "admin";

export type StaffNavigationItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  requiredPermissions: readonly Permission[];
  section?: StaffNavigationSection;
  countKey?: keyof AdminNavCounts;
  stations?: readonly Station[];
  aliases?: readonly string[];
};

export type StaffNavCounts = Partial<AdminNavCounts>;

const staffNavigationItems: readonly StaffNavigationItem[] = [
  ...adminNavigationItems.map((item) => ({
    key: item.key,
    href: item.href,
    label: item.label,
    icon: item.icon,
    requiredPermissions: [PERMISSIONS.ADMIN_ACCESS, item.permission] as const,
    section: "admin" as const,
    countKey: item.countKey,
  })),
  {
    key: "manager-home",
    href: "/manager",
    label: "Manager",
    icon: Store,
    requiredPermissions: [PERMISSIONS.DASHBOARD_VIEW] as const,
    section: "operations",
  },
  {
    key: "manager-waiter-orders",
    href: "/manager/waiter-orders",
    label: "Manager orders",
    icon: ReceiptText,
    requiredPermissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ORDER_MANAGE,
    ] as const,
    section: "operations",
  },
  {
    key: "cashier-home",
    href: "/cashier",
    label: "Cashier",
    icon: Shirt,
    requiredPermissions: [PERMISSIONS.ORDER_MANAGE] as const,
    section: "operations",
  },
  {
    key: "cashier-order",
    href: "/cashier/order",
    label: "New order",
    icon: ClipboardList,
    requiredPermissions: [PERMISSIONS.ORDER_MANAGE, PERMISSIONS.ORDER_CREATE] as const,
    section: "operations",
  },
  {
    key: "cashier-waiter-orders",
    href: "/cashier/waiter-orders",
    label: "Cashier waiter orders",
    icon: ReceiptText,
    requiredPermissions: [PERMISSIONS.ORDER_MANAGE] as const,
    section: "operations",
  },
  {
    key: "waiter-home",
    href: "/waiter",
    label: "Waiter",
    icon: Users,
    requiredPermissions: [PERMISSIONS.ORDER_VIEW_ASSIGNED] as const,
    section: "operations",
  },
  {
    key: "inventory-home",
    href: "/inventory",
    label: "Inventory",
    icon: PackageSearch,
    requiredPermissions: [PERMISSIONS.INVENTORY_VIEW] as const,
    stations: ["CABITAAN"],
    section: "operations",
  },
  {
    key: "kitchen-home",
    href: "/kitchen",
    label: "Kitchen",
    icon: UtensilsCrossed,
    requiredPermissions: [PERMISSIONS.KITCHEN_TICKET_VIEW] as const,
    section: "kitchen",
  },
  {
    key: "kitchen-barista",
    href: "/kitchen/barista",
    label: "Barista",
    icon: Coffee,
    requiredPermissions: [PERMISSIONS.KITCHEN_TICKET_VIEW] as const,
    stations: ["BARISTA"],
    section: "kitchen",
  },
  {
    key: "kitchen-cabitaan",
    href: "/kitchen/cabitaan",
    label: "Cabitaan",
    icon: Coffee,
    requiredPermissions: [PERMISSIONS.KITCHEN_TICKET_VIEW] as const,
    stations: ["CABITAAN"],
    section: "kitchen",
  },
  {
    key: "kitchen-cunto-soomaali",
    href: "/kitchen/cunto-soomaali",
    label: "Cunto Soomaali",
    icon: ChefHat,
    requiredPermissions: [PERMISSIONS.KITCHEN_TICKET_VIEW] as const,
    stations: ["CUNTO_SOOMAALI"],
    section: "kitchen",
  },
  {
    key: "kitchen-fast-food",
    href: "/kitchen/fast-food",
    label: "Fast food",
    icon: UtensilsCrossed,
    requiredPermissions: [PERMISSIONS.KITCHEN_TICKET_VIEW] as const,
    stations: ["FAST_FOOD"],
    section: "kitchen",
  },
] as const satisfies readonly StaffNavigationItem[];

const sectionLabels: Record<StaffNavigationSection, string> = {
  admin: "Administration",
  operations: "Operations",
  kitchen: "Kitchen",
};

export function getVisibleStaffNavigationItems(
  currentUser: Pick<PermissionUser, "role" | "station">,
  scope: StaffNavigationScope = "all",
): StaffNavigationItem[] {
  const items =
    scope === "admin"
      ? staffNavigationItems.filter((item) => item.section === "admin")
      : staffNavigationItems;

  return items.filter((item) => {
    if (
      !item.requiredPermissions.every((permission) =>
        hasPermission(currentUser, permission),
      )
    ) {
      return false;
    }
    if (item.stations && !canAccessStation(currentUser, item.stations)) {
      return false;
    }

    return true;
  });
}

export function getStaffNavigationSectionsFromItems(
  items: readonly StaffNavigationItem[],
) {
  return (Object.keys(sectionLabels) as StaffNavigationSection[]).reduce<
    {
      section: StaffNavigationSection;
      label: string;
      items: StaffNavigationItem[];
    }[]
  >((groups, section) => {
    const sectionItems = items.filter(
      (item) => (item.section ?? "admin") === section,
    );

    if (sectionItems.length > 0) {
      groups.push({
        section,
        label: sectionLabels[section],
        items: sectionItems,
      });
    }

    return groups;
  }, []);
}

export function isStaffNavActive(pathname: string, item: StaffNavigationItem) {
  if (item.aliases?.includes(pathname)) return true;
  if (item.href === "/admin/dashboard") {
    return pathname === "/admin" || pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
