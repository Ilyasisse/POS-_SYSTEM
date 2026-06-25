import type { ReactNode } from "react";

import StaffShell from "@/components/staff/StaffShell";
import { requireRole } from "@/lib/auth/require-role";

type ManagerLayoutProps = {
  children: ReactNode;
};

export default async function ManagerLayout({ children }: ManagerLayoutProps) {
  const currentUser = await requireRole(["MANAGER", "ADMIN"]);

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
