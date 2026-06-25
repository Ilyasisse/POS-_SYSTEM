import type { ReactNode } from "react";

import StaffShell from "@/components/staff/StaffShell";
import { requireRole } from "@/lib/auth/require-role";

type KitchenLayoutProps = {
  children: ReactNode;
};

export default async function KitchenLayout({ children }: KitchenLayoutProps) {
  const currentUser = await requireRole([
    "COOK",
    "BARISTA",
    "Cabitaan",
    "ADMIN",
  ]);

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
