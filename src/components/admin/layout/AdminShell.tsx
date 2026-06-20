"use client";

import type { ReactNode } from "react";
import {  useMemo, } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faBell,
  faBoxesStacked,
  faChartLine,
  faCircle,
  faClipboardList,
  faCubesStacked,
  faGear,
  faHome,
  faLayerGroup,
  faMagnifyingGlass,
  faMugHot,
  faPuzzlePiece,
  faReceipt,
  faTableCells,
  faTimes,
  faUser,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import SignOutButton from "@/components/SignOutButton";
import AdminMobileSidebar from "./AdminMobileSidebar";
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

export type AdminShellProps = {
  children: ReactNode;
  currentUser: {
    fullName: string;
    role: string;
    permissions: Permission[];
  };
  counts: AdminNavCounts;
};

type AdminNavItem = {
  key:
    | "dashboard"
    | "categories"
    | "products"
    | "inventory"
    | "modifiers"
    | "modifierGroups"
    | "staff"
    | "tables"
    | "orders"
    | "reports"
    | "settings"
    | "profile";
  href: string;
  label: string;
  icon: IconDefinition;
  permission: Permission;
  count?: number;
};

function formatRole(role: string) {
  if (role === "ADMIN") {
    return "Administrator";
  }

  return role.charAt(0) + role.slice(1).toLowerCase();
}



function isNavActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") {
    return pathname === "/admin" || pathname === "/admin/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  currentUser,
  counts,
  pathname,
  onNavigate,
}: {
  currentUser: AdminShellProps["currentUser"];
  counts: AdminNavCounts;
  pathname: string;
  onNavigate?: () => void;
}) {
  const navItems: AdminNavItem[] = [
    {
      key: "dashboard",
      href: "/admin/dashboard",
      label: "Dashboard",
      icon: faHome,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      key: "categories",
      href: "/admin/categories",
      label: "Categories",
      icon: faLayerGroup,
      permission: PERMISSIONS.CATALOG_MANAGE,
      count: counts.categories,
    },
    {
      key: "products",
      href: "/admin/products",
      label: "Products",
      icon: faBoxesStacked,
      permission: PERMISSIONS.CATALOG_MANAGE,
      count: counts.products,
    },
    {
      key: "inventory",
      href: "/admin/inventory",
      label: "Inventory",
      icon: faClipboardList,
      permission: PERMISSIONS.INVENTORY_VIEW,
    },
    {
      key: "modifiers",
      href: "/admin/modifiers",
      label: "Modifiers",
      icon: faPuzzlePiece,
      permission: PERMISSIONS.CATALOG_MANAGE,
      count: counts.modifiers,
    },
    {
      key: "modifierGroups",
      href: "/admin/modifier-groups",
      label: "Modifier Groups",
      icon: faCubesStacked,
      permission: PERMISSIONS.CATALOG_MANAGE,
      count: counts.modifierGroups,
    },
    {
      key: "staff",
      href: "/admin/staff",
      label: "Staff",
      icon: faUserGroup,
      permission: PERMISSIONS.STAFF_MANAGE,
      count: counts.staff,
    },
    {
      key: "tables",
      href: "/admin/tables",
      label: "Tables",
      icon: faTableCells,
      permission: PERMISSIONS.TABLE_MANAGE,
      count: counts.tables,
    },
    {
      key: "orders",
      href: "/admin/orders",
      label: "Orders",
      icon: faReceipt,
      permission: PERMISSIONS.ORDER_VIEW_ALL,
      count: counts.orders,
    },
    {
      key: "reports",
      href: "/admin/reports",
      label: "Reports",
      icon: faChartLine,
      permission: PERMISSIONS.REPORT_VIEW,
    },
    {
      key: "settings",
      href: "/admin/settings",
      label: "Settings",
      icon: faGear,
      permission: PERMISSIONS.SETTINGS_MANAGE,
    },
   
  ];

  return (
    <div className="flex h-full flex-col bg-white text-slate-900">
      <div className="flex min-h-20 items-center gap-3 border-b border-slate-100 px-5">
        <div className="grid size-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
          <FontAwesomeIcon icon={faMugHot} className="text-xl" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black leading-5 tracking-tight">
            MASH ALLAH
          </p>
          <p className="text-sm font-medium text-slate-500">Welcome Back!</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
        {navItems.map((item) => {
          if (!currentUser.permissions.includes(item.permission)) return null;

          const active = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${
                active
                  ? "bg-blue-50 text-blue-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <FontAwesomeIcon
                icon={item.icon}
                className={`w-5 ${active ? "text-blue-600" : "text-slate-500"}`}
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {typeof item.count === "number" ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    active
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-blue-700"
                  }`}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-100 p-4">
        <Link
          href="/admin/profile"
          onClick={onNavigate}
          className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:bg-blue-50"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-700 font-bold text-white">
              {currentUser.fullName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">
                {currentUser.fullName}
              </p>
              <p className="text-xs font-medium text-slate-500">
                {formatRole(currentUser.role)}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <FontAwesomeIcon
                  icon={faCircle}
                  className="text-[7px] text-emerald-500"
                />
                Online
              </p>
            </div>
          </div>
        </Link>

       
      </div>
    </div>
  );
}

export default function AdminShell({
  children,
  currentUser,
  counts,
}: AdminShellProps) {
  const pathname = usePathname();
 
  const notificationCount = useMemo(() => counts.orders, [counts]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white shadow-sm lg:block">
        <SidebarContent
          currentUser={currentUser}
          counts={counts}
          pathname={pathname}
        />
      </aside>

 
   <AdminMobileSidebar
  currentUser={currentUser}
  counts={counts}
  pathname={pathname}
  SidebarContent={SidebarContent}
/>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-18 items-center gap-3 px-3 py-3 sm:px-5 lg:px-6">
            


            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="hidden min-h-11 w-[min(21rem,34vw)] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-slate-500 shadow-sm md:flex">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="text-sm" />
                {/* REVIEW: This search is visual-only until global admin search is defined. */}
                <input
                  type="search"
                  placeholder="Search anything..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
                />
                <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">
                  Ctrl + K
                </span>
              </div>

              <button
                type="button"
                className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Notifications"
              >
                <FontAwesomeIcon icon={faBell} />
                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white">
                    {notificationCount}
                  </span>
                ) : null}
              </button>

             

              <div className="hidden sm:block">
                <SignOutButton />
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-[calc(100vh-4.5rem)]">{children}</div>
      </div>
    </div>
  );
}
