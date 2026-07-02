import type { ReactNode } from "react";

import StaffShell from "@/components/staff/layout/StaffShell";
import { getPermissionsForRole, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

type ManagerLayoutProps = {
  children: ReactNode;
};

export default async function ManagerLayout({ children }: ManagerLayoutProps) {
  const currentUser = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);

  return (
    <StaffShell
      currentUser={{
        fullName: currentUser.fullName,
        role: currentUser.role,
        station: currentUser.station ?? null,
        permissions: getPermissionsForRole(currentUser.role),
      }}
      workspaceLabel="Manager"
      workspaceDescription="Waiter balance operations"
    >
      {children}
    </StaffShell>
  );
}
