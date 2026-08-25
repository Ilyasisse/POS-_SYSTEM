"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  ChevronsUpDown,
  Coffee,
  UserRound,
} from "lucide-react";

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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { StaffShellCurrentUser } from "./StaffShell";
import {
  getActiveStaffNavigationGroupKey,
  getNextOpenStaffNavigationGroupKey,
  getStaffNavigationNodesFromItems,
  getVisibleStaffNavigationItems,
  isStaffNavActive,
  type StaffNavCounts,
  type StaffNavigationGroupKey,
  type StaffNavigationNode,
  type StaffNavigationScope,
} from "./staff-navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";

type StaffSidebarProps = {
  currentUser: StaffShellCurrentUser;
  counts?: StaffNavCounts;
  navigationScope?: StaffNavigationScope;
};

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

type ExpandedNavigationMenuProps = {
  counts?: StaffNavCounts;
  navigationNodes: StaffNavigationNode[];
  onNavigate: () => void;
  pathname: string;
};

function ExpandedNavigationMenu({
  counts,
  navigationNodes,
  onNavigate,
  pathname,
}: ExpandedNavigationMenuProps) {
  const [openGroupKey, setOpenGroupKey] =
    useState<StaffNavigationGroupKey | null>(
      () => getActiveStaffNavigationGroupKey(pathname, navigationNodes),
    );

  return (
    <SidebarMenu>
      {navigationNodes.map((node) => {
        if (node.type === "group") {
          const Icon = node.icon;
          const groupActive = node.items.some((item) =>
            isStaffNavActive(pathname, item),
          );
          const groupOpen = openGroupKey === node.key;
          const submenuId = `sidebar-group-${node.key}`;

          return (
            <SidebarMenuItem key={node.key}>
              <SidebarMenuButton
                type="button"
                size="lg"
                tooltip={node.label}
                isActive={groupActive}
                className="rounded-xl"
                aria-expanded={groupOpen}
                aria-controls={submenuId}
                onClick={() =>
                  setOpenGroupKey((current) =>
                    getNextOpenStaffNavigationGroupKey(current, node.key),
                  )
                }
              >
                <Icon aria-hidden="true" />
                <span>{node.label}</span>
                <ChevronRight
                  className={cn(
                    "ml-auto transition-transform duration-200",
                    groupOpen ? "rotate-90" : null,
                  )}
                  aria-hidden="true"
                />
              </SidebarMenuButton>
              <SidebarMenuSub id={submenuId} hidden={!groupOpen}>
                {node.items.map((item) => {
                  const active = isStaffNavActive(pathname, item);
                  const count = item.countKey
                    ? counts?.[item.countKey]
                    : undefined;
                  const ItemIcon = item.icon;

                  return (
                    <SidebarMenuSubItem key={item.key}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={active}
                        className="h-9"
                      >
                        <Link
                          href={item.href}
                          prefetch={false}
                          aria-current={active ? "page" : undefined}
                          onClick={() => {
                            setOpenGroupKey(node.key);
                            onNavigate();
                          }}
                        >
                          <ItemIcon aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          {typeof count === "number" ? (
                            <Badge variant="secondary" className="ml-auto">
                              {count}
                            </Badge>
                          ) : null}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </SidebarMenuItem>
          );
        }

        const { item } = node;
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
                prefetch={false}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setOpenGroupKey(null);
                  onNavigate();
                }}
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
  );
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
  const navigationNodes = getStaffNavigationNodesFromItems(visibleItems);
  const hasAdminAccess = currentUser.permissions.includes(
    PERMISSIONS.ADMIN_ACCESS,
  );
  const compactNavigation = state === "collapsed" && !isMobile;
  const [compactOpenGroupKey, setCompactOpenGroupKey] =
    useState<StaffNavigationGroupKey | null>(null);

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
                {navigationNodes.map((node) => {
                  if (node.type === "link") {
                    const { item } = node;
                    const Icon = item.icon;
                    const active = isStaffNavActive(pathname, item);
                    const count = item.countKey
                      ? counts?.[item.countKey]
                      : undefined;
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
                            prefetch={false}
                            aria-current={active ? "page" : undefined}
                            onClick={() => {
                              setCompactOpenGroupKey(null);
                              handleNavigate();
                            }}
                          >
                            <Icon aria-hidden="true" />
                            <span className="sr-only">{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  const Icon = node.icon;
                  const groupActive = node.items.some((item) =>
                    isStaffNavActive(pathname, item),
                  );

                  return (
                    <SidebarMenuItem key={node.key}>
                    <DropdownMenu
                      modal={false}
                      open={compactOpenGroupKey === node.key}
                      onOpenChange={(open) =>
                        setCompactOpenGroupKey(open ? node.key : null)
                      }
                    >
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          size="lg"
                          tooltip={node.label}
                          className="rounded-xl"
                          isActive={groupActive}
                          aria-label={`Open ${node.label} routes`}
                        >
                          <Icon aria-hidden="true" />
                          <span className="sr-only">{node.label}</span>
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-64">
                        <DropdownMenuLabel>{node.label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {node.items.map((item) => {
                          const Icon = item.icon;
                          const count = item.countKey
                            ? counts?.[item.countKey]
                            : undefined;

                          return (
                            <DropdownMenuItem key={item.key} asChild>
                              <Link
                                href={item.href}
                                prefetch={false}
                                onClick={() => {
                                  setCompactOpenGroupKey(null);
                                  handleNavigate();
                                }}
                                className="flex w-full items-center gap-2"
                                aria-current={
                                  isStaffNavActive(pathname, item)
                                    ? "page"
                                    : undefined
                                }
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
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <div className="py-2">
            <SidebarGroup>
              <SidebarGroupContent>
                <ExpandedNavigationMenu
                  key={pathname}
                  counts={counts}
                  navigationNodes={navigationNodes}
                  onNavigate={handleNavigate}
                  pathname={pathname}
                />
              </SidebarGroupContent>
            </SidebarGroup>
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
                    <Link
                      href="/admin/profile"
                      prefetch={false}
                      onClick={handleNavigate}
                    >
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
