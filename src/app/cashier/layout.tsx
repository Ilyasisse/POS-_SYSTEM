import type { ReactNode } from "react";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

type CashierLayoutProps = {
  children: ReactNode;
};

export default async function CashierLayout({ children }: CashierLayoutProps) {
  await requirePermission(PERMISSIONS.ORDER_MANAGE);
  return children;
}
