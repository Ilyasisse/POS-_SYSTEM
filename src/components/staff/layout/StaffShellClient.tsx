"use client";

import { Search } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import {
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  SidebarProvider,
} from "@/components/ui/sidebar";
import type { StaffShellProps } from "./StaffShell";
import PaymentGatewayBanner from "./PaymentGatewayBanner";
import StaffSidebar from "./StaffSidebar";

type StaffShellClientProps = StaffShellProps & {
  defaultSidebarOpen: boolean;
};

export default function StaffShellClient({
  children,
  currentUser,
  counts,
  navigationScope = "all",
  workspaceLabel,
  workspaceDescription,
  tone = "light",
  searchSlot,
  headerActions,
  defaultSidebarOpen,
}: StaffShellClientProps) {
  return (
    <SidebarProvider
      defaultOpen={defaultSidebarOpen}
      className="staff-shell min-h-screen bg-background text-foreground"
      data-surface-tone={tone}
    >
      <Sidebar collapsible="icon">
        <StaffSidebar
          currentUser={currentUser}
          counts={counts}
          navigationScope={navigationScope}
        />
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="w-full min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
            <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5 lg:px-6">
              <SidebarTrigger className="shrink-0" />

              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  {workspaceLabel}
                </p>
                {workspaceDescription ? (
                  <p className="truncate text-sm font-semibold text-foreground">
                    {workspaceDescription}
                  </p>
                ) : null}
              </div>

              {searchSlot ? (
                <div className="relative ml-auto hidden w-[min(21rem,34vw)] md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  {searchSlot}
                </div>
              ) : null}

              {headerActions ? (
                <div className="hidden items-center gap-2 sm:flex">
                  {headerActions}
                </div>
              ) : null}

              <div className="ml-auto flex items-center gap-2">
                <ModeToggle />
                {headerActions ? (
                  <div className="flex items-center gap-2 sm:hidden">
                    {headerActions}
                  </div>
                ) : null}
              </div>
            </div>
            {searchSlot ? (
              <div className="border-t border-border/70 px-3 py-3 md:hidden">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  {searchSlot}
                </div>
              </div>
            ) : null}
        </header>

        <PaymentGatewayBanner />

        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
