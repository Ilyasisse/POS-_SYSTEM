"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, Coffee, Ellipsis, UserRound } from "lucide-react";

import SignOutButton from "@/components/SignOutButton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { StaffShellCurrentUser } from "./StaffShell";
import {
  getStaffNavigationSectionsFromItems,
  getVisibleStaffNavigationItems,
  isStaffNavActive,
  type StaffNavCounts,
  type StaffNavigationScope,
} from "./staff-navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";

type StaffSidebarProps = {
  currentUser: StaffShellCurrentUser;
  counts?: StaffNavCounts;
  navigationScope?: StaffNavigationScope;
};

const MAX_COLLAPSED_ROUTE_ICONS = 13;

function formatRole(role: string) {
  if (role === "ADMIN") return "Administrator";
  if (role === "Cabitaan") return "Cabitaan";
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

export default function StaffSidebar({
  currentUser,
  counts,
  navigationScope,
}: StaffSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const handleNavigate = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  const visibleItems = getVisibleStaffNavigationItems(
    currentUser,
    navigationScope,
  );
  const sections = getStaffNavigationSectionsFromItems(visibleItems);
  const hasAdminAccess = currentUser.permissions.includes(
    PERMISSIONS.ADMIN_ACCESS,
  );
  const compactNavigation = state === "collapsed" && !isMobile;
  const activeItem = visibleItems.find((item) =>
    isStaffNavActive(pathname, item),
  );
  const firstCompactItems = visibleItems.slice(0, MAX_COLLAPSED_ROUTE_ICONS);
  const compactItems =
    activeItem && !firstCompactItems.some((item) => item.key === activeItem.key)
      ? [
          ...firstCompactItems.slice(0, MAX_COLLAPSED_ROUTE_ICONS - 1),
          activeItem,
        ]
      : firstCompactItems;
  const compactItemKeys = new Set(compactItems.map((item) => item.key));
  const additionalItems = visibleItems.filter(
    (item) => !compactItemKeys.has(item.key),
  );

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Coffee className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-base font-bold tracking-tight">
              Mash Allah Cafe
            </p>
            <p className="text-xs text-sidebar-foreground/65">
              Role-aware workspace
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {compactNavigation ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {compactItems.map((item) => {
                  const Icon = item.icon;
                  const active = isStaffNavActive(pathname, item);
                  const count = item.countKey ? counts?.[item.countKey] : undefined;
                  const tooltip =
                    typeof count === "number"
                      ? `${item.label} (${count})`
                      : item.label;

                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        size="lg"
                        tooltip={tooltip}
                        isActive={active}
                        className="rounded-xl"
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={handleNavigate}
                        >
                          <Icon aria-hidden="true" />
                          <span className="sr-only">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}

                {additionalItems.length > 0 ? (
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          size="lg"
                          tooltip="More routes"
                          className="rounded-xl"
                          aria-label="More authorized routes"
                        >
                          <Ellipsis aria-hidden="true" />
                          <span className="sr-only">More routes</span>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-64">
                        {additionalItems.map((item) => {
                          const Icon = item.icon;
                          const count = item.countKey
                            ? counts?.[item.countKey]
                            : undefined;

                          return (
                            <DropdownMenuItem key={item.key} asChild>
                              <Link
                                href={item.href}
                                onClick={handleNavigate}
                                className="flex w-full items-center gap-2"
                              >
                                <Icon aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">
                                  {item.label}
                                </span>
                                {typeof count === "number" ? (
                                  <Badge variant="secondary">{count}</Badge>
                                ) : null}
                              </Link>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <div className="space-y-4 py-2">
            {sections.map((section) => (
            <SidebarGroup key={section.section}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const active = isStaffNavActive(pathname, item);
                    const count = item.countKey ? counts?.[item.countKey] : undefined;
                    const Icon = item.icon;

                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          asChild
                          size="lg"
                          tooltip={item.label}
                          isActive={active}
                          className={cn(
                            "rounded-xl",
                            count
                              ? "group-has-data-[sidebar=menu-badge]/menu-item:pr-10"
                              : null,
                          )}
                        >
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            onClick={handleNavigate}
                          >
                            <Icon aria-hidden="true" />
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
            ))}
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={`${currentUser.fullName} - ${formatRole(currentUser.role)}`}
                  className="rounded-xl data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                    {initials(currentUser.fullName)}
                  </span>
                  <span className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">
                      {currentUser.fullName}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/65">
                      {formatRole(currentUser.role)}
                      {currentUser.station ? ` - ${currentUser.station}` : ""}
                    </span>
                  </span>
                  <ChevronsUpDown
                    className="ml-auto size-4 group-data-[collapsible=icon]:hidden"
                    aria-hidden="true"
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
                className="w-64"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                      {initials(currentUser.fullName)}
                    </span>
                    <span className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-semibold">
                        {currentUser.fullName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatRole(currentUser.role)}
                      </span>
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hasAdminAccess ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/profile" onClick={handleNavigate}>
                      <UserRound aria-hidden="true" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <SignOutButton
                  role="menuitem"
                  variant="ghost"
                  className="h-auto w-full justify-start rounded-md px-1.5 py-1 text-sm font-normal text-foreground hover:bg-accent hover:text-accent-foreground"
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
