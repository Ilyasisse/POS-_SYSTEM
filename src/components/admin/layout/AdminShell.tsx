"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Circle, Coffee, Search } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Permission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import AdminMobileSidebar from "./AdminMobileSidebar";
import {
  adminNavigationItems,
  type AdminNavCounts,
} from "./admin-navigation";

export type { AdminNavCounts } from "./admin-navigation";

export type AdminShellProps = {
  children: ReactNode;
  currentUser: {
    fullName: string;
    role: string;
    permissions: Permission[];
  };
  counts: AdminNavCounts;
};

export type AdminSidebarContentProps = {
  currentUser: AdminShellProps["currentUser"];
  counts: AdminNavCounts;
  pathname: string;
  onNavigate?: () => void;
};

function formatRole(role: string) {
  if (role === "ADMIN") return "Administrator";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function initials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") {
    return pathname === "/admin" || pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebarContent({
  currentUser,
  counts,
  pathname,
  onNavigate,
}: AdminSidebarContentProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex min-h-20 items-center gap-3 px-5">
        <div className="grid size-11 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Coffee className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight">
            Mash Allah Café
          </p>
          <p className="text-xs text-sidebar-foreground/65">Administration</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav
        aria-label="Admin navigation"
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >
        {adminNavigationItems.map((item) => {
          if (!currentUser.permissions.includes(item.permission)) return null;

          const active = isAdminNavActive(pathname, item.href);
          const count = item.countKey ? counts[item.countKey] : undefined;
          const Icon = item.icon;

          return (
            <Button
              key={item.key}
              variant="ghost"
              asChild
              className={cn(
                "h-11 w-full justify-start gap-3 px-3 text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active &&
                  "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
              )}
            >
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4.5" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {item.label}
                </span>
                {typeof count === "number" ? (
                  <Badge className="border-sidebar-border bg-sidebar-primary/15 text-sidebar-foreground">
                    {count}
                  </Badge>
                ) : null}
              </Link>
            </Button>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <Button
          asChild
          variant="ghost"
          className="h-auto w-full justify-start gap-3 p-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Link href="/admin/profile" onClick={onNavigate}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
              {initials(currentUser.fullName)}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold">
                {currentUser.fullName}
              </span>
              <span className="block text-xs text-sidebar-foreground/65">
                {formatRole(currentUser.role)}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-sidebar-foreground/70">
                <Circle className="size-2 fill-success text-success" /> Online
              </span>
            </span>
          </Link>
        </Button>
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

  return (
    <div className="min-h-screen bg-muted/35">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-sidebar-border lg:block">
        <AdminSidebarContent
          currentUser={currentUser}
          counts={counts}
          pathname={pathname}
        />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
          <div className="flex min-h-16 items-center gap-2 px-3 sm:px-5 lg:px-6">
            <AdminMobileSidebar
              currentUser={currentUser}
              counts={counts}
              pathname={pathname}
              SidebarContent={AdminSidebarContent as ComponentType<AdminSidebarContentProps>}
            />

            <div className="relative ml-auto hidden w-[min(21rem,34vw)] md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search admin"
                type="search"
                placeholder="Search admin…"
                className="h-10 bg-card pl-9"
              />
            </div>

            <ModeToggle />

            <Button
              variant="outline"
              size="icon"
              className="relative"
              aria-label={`${counts.orders} open order notifications`}
            >
              <Bell className="size-4" />
              {counts.orders > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-5 text-white">
                  {counts.orders}
                </span>
              ) : null}
            </Button>

            <div className="hidden sm:block">
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  );
}
