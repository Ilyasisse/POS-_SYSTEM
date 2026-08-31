import CashierOrderExperience from "@/components/cashier/CashierOrderExperience";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

export default async function CashierTakeawayPage() {
  await requirePermission(PERMISSIONS.ORDER_CREATE);

  return <CashierOrderExperience tables={[]} orderType="TAKEOUT" />;
}
