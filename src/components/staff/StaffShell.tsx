"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoxesStacked,
  faChartLine,
  faClipboardList,
  faCubesStacked,
  faGear,
  faHome,
  faLayerGroup,
  faMugHot,
  faPuzzlePiece,
  faReceipt,
  faTableCells,
  faTruck,
  faUser,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ModeToggle } from "@/components/ModeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  Sparkles,
} from "lucide-react";

type StaffUser = {
  fullName: string;
  email?: string | null;
  role: string;
  station?: string | null;
};

type StaffCounts = Partial<{
  categories: number;
  products: number;
  modifiers: number;
  modifierGroups: number;
  staff: number;
  tables: number;
  orders: number;
}>;

type StaffShellProps = {
  children: ReactNode;
  currentUser: StaffUser;
  counts?: StaffCounts;
};

type StaffNavItem = {
  key: string;
  section: "Admin" | "Manager" | "Cashier" | "Service" | "Kitchen";
  href: string;
  label: string;
  icon: IconDefinition;
  allowedRoles: string[];
  allowedStations?: string[];
  countKey?: keyof StaffCounts;
  important?: boolean;
};

const STAFF_NAV_ITEMS: StaffNavItem[] = [
  {
    key: "admin-dashboard",
    section: "Admin",
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: faHome,
    allowedRoles: ["ADMIN", "MANAGER"],
    important: true,
  },
  {
    key: "admin-categories",
    section: "Admin",
    href: "/admin/categories",
    label: "Categories",
    icon: faLayerGroup,
    allowedRoles: ["ADMIN", "MANAGER"],
    countKey: "categories",
  },
  {
    key: "admin-products",
    section: "Admin",
    href: "/admin/products",
    label: "Products",
    icon: faBoxesStacked,
    allowedRoles: ["ADMIN", "MANAGER"],
    countKey: "products",
    important: true,
  },
  {
    key: "admin-inventory",
    section: "Admin",
    href: "/admin/inventory",
    label: "Inventory",
    icon: faClipboardList,
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    key: "admin-modifiers",
    section: "Admin",
    href: "/admin/modifiers",
    label: "Modifiers",
    icon: faPuzzlePiece,
    allowedRoles: ["ADMIN", "MANAGER"],
    countKey: "modifiers",
  },
  {
    key: "admin-modifier-groups",
    section: "Admin",
    href: "/admin/modifier-groups",
    label: "Modifier Groups",
    icon: faCubesStacked,
    allowedRoles: ["ADMIN", "MANAGER"],
    countKey: "modifierGroups",
  },
  {
    key: "admin-staff",
    section: "Admin",
    href: "/admin/staff",
    label: "Staff",
    icon: faUserGroup,
    allowedRoles: ["ADMIN", "MANAGER"],
    countKey: "staff",
  },
  {
    key: "admin-tables",
    section: "Admin",
    href: "/admin/tables",
    label: "Tables",
    icon: faTableCells,
    allowedRoles: ["ADMIN", "MANAGER"],
    countKey: "tables",
  },
  {
    key: "admin-orders",
    section: "Admin",
    href: "/admin/orders",
    label: "Orders",
    icon: faReceipt,
    allowedRoles: ["ADMIN", "MANAGER"],
    countKey: "orders",
    important: true,
  },
  {
    key: "admin-suppliers",
    section: "Admin",
    href: "/admin/suppliers",
    label: "Suppliers",
    icon: faTruck,
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    key: "admin-deliveries",
    section: "Admin",
    href: "/admin/supplier-deliveries",
    label: "Supplier Deliveries",
    icon: faClipboardList,
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    key: "admin-reports",
    section: "Admin",
    href: "/admin/reports",
    label: "Reports",
    icon: faChartLine,
    allowedRoles: ["ADMIN", "MANAGER"],
    important: true,
  },
  {
    key: "admin-supplier-bills",
    section: "Admin",
    href: "/admin/reports/supplier-bills",
    label: "Supplier Bills",
    icon: faReceipt,
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    key: "admin-settings",
    section: "Admin",
    href: "/admin/settings",
    label: "Settings",
    icon: faGear,
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    key: "admin-profile",
    section: "Admin",
    href: "/admin/profile",
    label: "Profile",
    icon: faUser,
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    key: "manager-dashboard",
    section: "Manager",
    href: "/manager",
    label: "Manager Dashboard",
    icon: faChartLine,
    allowedRoles: ["ADMIN", "MANAGER"],
    important: true,
  },
  {
    key: "manager-waiter-orders",
    section: "Manager",
    href: "/manager/waiter-orders",
    label: "Waiter Orders",
    icon: faClipboardList,
    allowedRoles: ["ADMIN", "MANAGER"],
    important: true,
  },
  {
    key: "manager-reports",
    section: "Manager",
    href: "/manager/reports",
    label: "Manager Reports",
    icon: faReceipt,
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    key: "cashier-dashboard",
    section: "Cashier",
    href: "/cashier",
    label: "Cashier",
    icon: faReceipt,
    allowedRoles: ["ADMIN", "CASHIER"],
    important: true,
  },
  {
    key: "cashier-order",
    section: "Cashier",
    href: "/cashier/order",
    label: "New Table Order",
    icon: faTableCells,
    allowedRoles: ["ADMIN", "CASHIER"],
    important: true,
  },
  {
    key: "waiter",
    section: "Service",
    href: "/waiter",
    label: "Waiter Pickup",
    icon: faClipboardList,
    allowedRoles: ["ADMIN", "WAITER"],
    important: true,
  },
  {
    key: "kitchen-overview",
    section: "Kitchen",
    href: "/kitchen",
    label: "Kitchen Overview",
    icon: faMugHot,
    allowedRoles: ["ADMIN", "COOK", "BARISTA", "Cabitaan", "CABITAAN"],
    important: true,
  },
  {
    key: "kitchen-barista",
    section: "Kitchen",
    href: "/kitchen/barista",
    label: "Barista",
    icon: faMugHot,
    allowedRoles: ["ADMIN", "BARISTA"],
    allowedStations: ["BARISTA"],
    important: true,
  },
  {
    key: "kitchen-fast-food",
    section: "Kitchen",
    href: "/kitchen/fast-food",
    label: "Fast Food",
    icon: faMugHot,
    allowedRoles: ["ADMIN", "COOK"],
    allowedStations: ["FAST_FOOD"],
    important: true,
  },
  {
    key: "kitchen-somali-food",
    section: "Kitchen",
    href: "/kitchen/cunto-soomaali",
    label: "Somali Food",
    icon: faMugHot,
    allowedRoles: ["ADMIN", "COOK"],
    allowedStations: ["CUNTO_SOOMAALI"],
    important: true,
  },
  {
    key: "kitchen-cabitaan",
    section: "Kitchen",
    href: "/kitchen/cabitaan",
    label: "Beverages",
    icon: faMugHot,
    allowedRoles: ["ADMIN", "COOK", "Cabitaan", "CABITAAN"],
    allowedStations: ["CABITAAN"],
    important: true,
  },
  {
    key: "inventory-use",
    section: "Kitchen",
    href: "/inventory",
    label: "Supply Inventory",
    icon: faClipboardList,
    allowedRoles: ["ADMIN", "Cabitaan", "CABITAAN"],
    allowedStations: ["CABITAAN"],
    important: true,
  },
];

const SECTION_ORDER: StaffNavItem["section"][] = [
  "Admin",
  "Manager",
  "Cashier",
  "Service",
  "Kitchen",
];

function normalizeRole(role: string) {
  return role === "Cabitaan" ? "CABITAAN" : role;
}

function getEffectiveStation(user: StaffUser) {
  if (user.station) {
    return user.station;
  }

  if (user.role === "BARISTA") {
    return "BARISTA";
  }

  if (normalizeRole(user.role) === "CABITAAN") {
    return "CABITAAN";
  }

  return null;
}

function canUseNavItem(user: StaffUser, item: StaffNavItem) {
  const role = normalizeRole(user.role);

  if (!item.allowedRoles.map(normalizeRole).includes(role)) {
    return false;
  }

  if (role === "ADMIN" || !item.allowedStations?.length) {
    return true;
  }

  const station = getEffectiveStation(user);
  return station ? item.allowedStations.includes(station) : false;
}

function formatRole(role: string) {
  switch (normalizeRole(role)) {
    case "ADMIN":
      return "Administrator";
    case "MANAGER":
      return "Manager";
    case "CASHIER":
      return "Cashier";
    case "WAITER":
      return "Waiter";
    case "BARISTA":
      return "Barista";
    case "COOK":
      return "Cook";
    case "CABITAAN":
      return "Beverages";
    default:
      return role;
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isNavActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") {
    return pathname === "/admin" || pathname === "/admin/dashboard";
  }

  if (href === "/manager" || href === "/cashier" || href === "/kitchen") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getHomeHref(user: StaffUser) {
  const role = normalizeRole(user.role);
  const station = getEffectiveStation(user);

  if (role === "ADMIN") return "/admin";
  if (role === "MANAGER") return "/manager";
  if (role === "CASHIER") return "/cashier";
  if (role === "WAITER") return "/waiter";
  if (role === "BARISTA" || station === "BARISTA") return "/kitchen/barista";
  if (role === "CABITAAN" || station === "CABITAAN") return "/kitchen/cabitaan";
  if (role === "COOK" && station === "FAST_FOOD") return "/kitchen/fast-food";
  if (role === "COOK" && station === "CUNTO_SOOMAALI") {
    return "/kitchen/cunto-soomaali";
  }

  return "/staff-login";
}

function getProfileHref(user: StaffUser) {
  return ["ADMIN", "MANAGER"].includes(normalizeRole(user.role))
    ? "/admin/profile"
    : getHomeHref(user);
}

function SidebarUserMenu({ currentUser }: { currentUser: StaffUser }) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const profileHref = getProfileHref(currentUser);
  const userSubtitle = currentUser.email ?? formatRole(currentUser.role);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/staff-login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground">
              {getInitials(currentUser.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{currentUser.fullName}</span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              {userSubtitle}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? "bottom" : "right"}
        align="end"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        sideOffset={4}
      >
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary font-bold text-primary-foreground">
                {getInitials(currentUser.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {currentUser.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {userSubtitle}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Sparkles />
          Staff workspace
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <BadgeCheck />
            {profileHref === "/admin/profile" ? "Profile" : "My workspace"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Bell />
          Notifications
        </DropdownMenuItem>
        <div className="flex items-center justify-between rounded-md px-1.5 py-1 text-sm">
          <span>Theme</span>
          <ModeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNav({
  currentUser,
  counts = {},
}: {
  currentUser: StaffUser;
  counts?: StaffCounts;
}) {
  const pathname = usePathname();
  const homeHref = getHomeHref(currentUser);
  const visibleItems = useMemo(
    () => STAFF_NAV_ITEMS.filter((item) => canUseNavItem(currentUser, item)),
    [currentUser],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Staff Workspace">
              <Link href={homeHref}>
                <div className="grid aspect-square size-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <FontAwesomeIcon icon={faMugHot} className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-black">MASH ALLAH</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    Staff Workspace
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 overflow-y-auto pb-2">
        {SECTION_ORDER.map((section) => {
          const sectionItems = visibleItems.filter(
            (item) => item.section === section,
          );

          if (sectionItems.length === 0) {
            return null;
          }

          return (
            <SidebarGroup key={section}>
              <SidebarGroupLabel>{section}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                {sectionItems.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const count =
                    item.countKey && typeof counts[item.countKey] === "number"
                      ? counts[item.countKey]
                      : undefined;

                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <FontAwesomeIcon icon={item.icon} className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {typeof count === "number" ? (
                        <SidebarMenuBadge>{count}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="sticky bottom-0 z-20 mt-auto shrink-0 border-t border-sidebar-border bg-sidebar shadow-[0_-8px_16px_var(--sidebar)]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarUserMenu currentUser={currentUser} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export default function StaffShell({
  children,
  currentUser,
  counts,
}: StaffShellProps) {
  return (
    <SidebarProvider>
        <SidebarNav currentUser={currentUser} counts={counts} />
      <SidebarInset>
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-3 py-3 sm:px-5 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatRole(currentUser.role)}
              </p>
              <p className="truncate text-sm font-bold text-foreground">
                {currentUser.fullName}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ModeToggle />
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground"
                      aria-label="Open user menu"
                    >
                      {getInitials(currentUser.fullName)}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <p className="truncate text-sm font-bold">
                        {currentUser.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {currentUser.email ?? formatRole(currentUser.role)}
                      </p>
                    </DropdownMenuLabel>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
