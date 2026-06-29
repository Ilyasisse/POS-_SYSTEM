import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import WaiterPickupPage from "@/components/waiter/WaiterPickupPage";

export default async function Page() {
  const currentUser = await requirePermission(PERMISSIONS.ORDER_VIEW_ASSIGNED);

  return (
    <WaiterPickupPage
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
