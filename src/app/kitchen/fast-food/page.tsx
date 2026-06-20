import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import KitchenClient from "@/components/kitchen/KitchenClient";

export default async function FastFoodPage() {
  const currentUser = await requirePermission(
    PERMISSIONS.KITCHEN_TICKET_VIEW,
    { stations: ["FAST_FOOD"] },
  );

  return (
    <KitchenClient
      station="FAST_FOOD"
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
