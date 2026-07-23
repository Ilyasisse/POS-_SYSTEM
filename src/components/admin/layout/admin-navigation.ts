import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  Layers3,
  PackageSearch,
  Puzzle,
  ReceiptText,
  Settings,
  TableProperties,
  Truck,
  Users,
  WalletCards,
  ShoppingBasket,
  ShoppingCart,
} from "lucide-react";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

export type AdminNavCounts = {
  categories: number;
  products: number;
  modifiers: number;
  modifierGroups: number;
  staff: number;
  tables: number;
  orders: number;
};

export type AdminNavigationItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  countKey?: keyof AdminNavCounts;
};

/**
 * Canonical admin navigation extension point. New admin features add one item
 * here; the desktop and mobile shells render the same permission-aware model.
 */
export const adminNavigationItems: readonly AdminNavigationItem[] = [
  {
    key: "dashboard",
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    key: "categories",
    href: "/admin/categories",
    label: "Categories",
    icon: Layers3,
    permission: PERMISSIONS.CATALOG_MANAGE,
    countKey: "categories",
  },
  {
    key: "products",
    href: "/admin/products",
    label: "Products",
    icon: Boxes,
    permission: PERMISSIONS.CATALOG_MANAGE,
    countKey: "products",
  },
  {
    key: "inventory",
    href: "/admin/inventory",
    label: "Inventory",
    icon: ClipboardList,
    permission: PERMISSIONS.INVENTORY_VIEW,
  },
  {
    key: "modifiers",
    href: "/admin/modifiers",
    label: "Modifiers",
    icon: Puzzle,
    permission: PERMISSIONS.CATALOG_MANAGE,
    countKey: "modifiers",
  },
  {
    key: "modifier-groups",
    href: "/admin/modifier-groups",
    label: "Modifier groups",
    icon: PackageSearch,
    permission: PERMISSIONS.CATALOG_MANAGE,
    countKey: "modifierGroups",
  },
  {
    key: "staff",
    href: "/admin/staff",
    label: "Staff",
    icon: Users,
    permission: PERMISSIONS.STAFF_MANAGE,
    countKey: "staff",
  },
  {
    key: "tables",
    href: "/admin/tables",
    label: "Tables",
    icon: TableProperties,
    permission: PERMISSIONS.TABLE_MANAGE,
    countKey: "tables",
  },
  {
    key: "orders",
    href: "/admin/orders",
    label: "Orders",
    icon: ReceiptText,
    permission: PERMISSIONS.ORDER_VIEW_ALL,
    countKey: "orders",
  },
  {
    key: "waiter-balances",
    href: "/admin/waiter-balances",
    label: "Waiter balances",
    icon: WalletCards,
    permission: PERMISSIONS.WAITER_BALANCE_ADMIN,
  },
  {
    key: "suppliers",
    href: "/admin/suppliers",
    label: "Suppliers",
    icon: Truck,
    permission: PERMISSIONS.SUPPLIER_MANAGE,
  },
  {
    key: "supplier-purchase-orders",
    href: "/admin/supplier-purchase-orders",
    label: "Purchase orders",
    icon: ShoppingCart,
    permission: PERMISSIONS.SUPPLIER_MANAGE,
  },
  {
    key: "supplier-invoices",
    href: "/admin/supplier-invoices",
    label: "Supplier invoices",
    icon: ClipboardList,
    permission: PERMISSIONS.SUPPLIER_MANAGE,
  },
  {
    key: "supplies",
    href: "/admin/supplies",
    label: "Supply",
    icon: ShoppingBasket,
    permission: PERMISSIONS.SUPPLY_MANAGE,
  },
  {
    key: "reports",
    href: "/admin/reports",
    label: "Reports",
    icon: ChartNoAxesCombined,
    permission: PERMISSIONS.REPORT_VIEW,
  },
  {
    key: "supplier-bills",
    href: "/admin/reports/supplier-bills",
    label: "Supplier bills",
    icon: ReceiptText,
    permission: PERMISSIONS.SUPPLIER_MANAGE,
  },
  {
    key: "settings",
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    permission: PERMISSIONS.SETTINGS_MANAGE,
  },
] as const;
