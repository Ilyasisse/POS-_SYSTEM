import type { ReactNode } from "react";

import StaffShell from "@/components/staff/layout/StaffShell";
import { getPermissionsForRole, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

type WaiterLayoutProps = {
  children: ReactNode;
};

export default async function WaiterLayout({ children }: WaiterLayoutProps) {
  const currentUser = await requirePermission(PERMISSIONS.ORDER_VIEW_ASSIGNED);

  return (
    <StaffShell
      currentUser={{
        fullName: currentUser.fullName,
        role: currentUser.role,
        station: currentUser.station ?? null,
        permissions: getPermissionsForRole(currentUser.role),
      }}
      workspaceLabel="Waiter"
      workspaceDescription="Assigned orders and pickup"
    >
      {children}
    </StaffShell>
  );
}
