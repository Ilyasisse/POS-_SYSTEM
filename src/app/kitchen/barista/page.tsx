import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import KitchenClient from "@/components/kitchen/KitchenClient";

export default async function BaristaPage() {
  const currentUser = await requirePermission(PERMISSIONS.KITCHEN_TICKET_VIEW, {
    stations: ["BARISTA"],
  });

  return (
    <KitchenClient
      station="BARISTA"
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
