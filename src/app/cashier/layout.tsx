import type { ReactNode } from "react";

import StaffShell from "@/components/staff/StaffShell";
import { requireRole } from "@/lib/auth/require-role";

type CashierLayoutProps = {
  children: ReactNode;
};

export default async function CashierLayout({ children }: CashierLayoutProps) {
  const currentUser = await requireRole(["CASHIER", "ADMIN"]);

  return (
    <StaffShell
      currentUser={{
        fullName: currentUser.fullName,
        email: currentUser.email,
        role: currentUser.role,
        station: currentUser.station,
      }}
    >
      {children}
    </StaffShell>
  );
}
