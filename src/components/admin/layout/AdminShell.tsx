import type { ReactNode } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminNavCounts } from "./admin-navigation";
import StaffShell, {
  type StaffShellCurrentUser,
} from "@/components/staff/layout/StaffShell";

export const ADMIN_SHELL_NAV_SCOPE = "admin" as const;

export type AdminShellProps = {
  children: ReactNode;
  currentUser: StaffShellCurrentUser;
  counts: AdminNavCounts;
};

export default function AdminShell({
  children,
  currentUser,
  counts,
}: AdminShellProps) {
  return (
    <StaffShell
      currentUser={currentUser}
      counts={counts}
      navigationScope={ADMIN_SHELL_NAV_SCOPE}
      workspaceLabel="Administration"
      workspaceDescription="Cafe management console"
      searchSlot={
        <Input
          aria-label="Search admin"
          type="search"
          placeholder="Search admin..."
          className="h-10 bg-card pl-9"
        />
      }
      headerActions={
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={`${counts.orders} open order notifications`}
        >
          <Bell className="size-4" aria-hidden="true" />
          {counts.orders > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-5 text-white">
              {counts.orders}
            </span>
          ) : null}
        </Button>
      }
    >
      {children}
    </StaffShell>
  );
}
