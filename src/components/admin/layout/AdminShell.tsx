import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { AdminNavCounts } from "./admin-navigation";
import StaffShell, { type StaffShellCurrentUser } from "@/components/staff/layout/StaffShell";

const ADMIN_SHELL_NAV_SCOPE = "admin" as const;

export type AdminShellProps = {
  children: ReactNode;
  currentUser: StaffShellCurrentUser;
  counts: AdminNavCounts;
};

export default function AdminShell({ children, currentUser, counts }: AdminShellProps) {
  return (
    <StaffShell
      currentUser={currentUser}
      counts={counts}
      navigationScope={ADMIN_SHELL_NAV_SCOPE}
      workspaceLabel="Administration"
      workspaceDescription="Cafe management console"
      headerActions={
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label="View dashboard alerts"
          asChild
        >
          <Link href="/admin#needs-attention">
            <Bell className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {children}
    </StaffShell>
  );
}
