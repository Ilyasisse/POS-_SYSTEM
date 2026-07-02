import type { ReactNode } from "react";

import StaffShell from "@/components/staff/layout/StaffShell";
import { getPermissionsForRole, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

type KitchenLayoutProps = {
  children: ReactNode;
};

export default async function KitchenLayout({ children }: KitchenLayoutProps) {
  const currentUser = await requirePermission(PERMISSIONS.KITCHEN_TICKET_VIEW);

  return (
    <StaffShell
      currentUser={{
        fullName: currentUser.fullName,
        role: currentUser.role,
        station: currentUser.station ?? null,
        permissions: getPermissionsForRole(currentUser.role),
      }}
      workspaceLabel="Kitchen"
      workspaceDescription="Station ticket queue"
      tone="dark"
    >
      {children}
    </StaffShell>
  );
}
