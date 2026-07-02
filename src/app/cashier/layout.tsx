import type { ReactNode } from "react";

import StaffShell from "@/components/staff/layout/StaffShell";
import { getPermissionsForRole, PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

type CashierLayoutProps = {
  children: ReactNode;
};

export default async function CashierLayout({ children }: CashierLayoutProps) {
  const currentUser = await requirePermission(PERMISSIONS.ORDER_MANAGE);

  return (
    <StaffShell
      currentUser={{
        fullName: currentUser.fullName,
        role: currentUser.role,
        station: currentUser.station ?? null,
        permissions: getPermissionsForRole(currentUser.role),
      }}
      workspaceLabel="Cashier"
      workspaceDescription="Checkout and table payments"
    >
      {children}
    </StaffShell>
  );
}
