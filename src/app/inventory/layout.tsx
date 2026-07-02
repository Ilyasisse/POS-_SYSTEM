import type { ReactNode } from "react";

import StaffShell from "@/components/staff/layout/StaffShell";
import { getPermissionsForRole, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

type InventoryLayoutProps = {
  children: ReactNode;
};

export default async function InventoryLayout({
  children,
}: InventoryLayoutProps) {
  const currentUser = await requirePermission(PERMISSIONS.INVENTORY_VIEW, {
    stations: ["CABITAAN"],
  });

  return (
    <StaffShell
      currentUser={{
        fullName: currentUser.fullName,
        role: currentUser.role,
        station: currentUser.station ?? null,
        permissions: getPermissionsForRole(currentUser.role),
      }}
      workspaceLabel="Inventory"
      workspaceDescription="Cabitaan supply use"
    >
      {children}
    </StaffShell>
  );
}
