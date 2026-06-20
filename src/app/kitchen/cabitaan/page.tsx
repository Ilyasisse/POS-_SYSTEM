import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import KitchenClient from "@/components/kitchen/KitchenClient";

export default async function CabitaanPage() {
  const currentUser = await requirePermission(
    PERMISSIONS.KITCHEN_TICKET_VIEW,
    { stations: ["CABITAAN"] },
  );

  return (
    <KitchenClient
      station="CABITAAN"
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
