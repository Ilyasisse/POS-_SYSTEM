import KitchenClient from "@/components/kitchen/KitchenClient";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

export default async function KitchenPage() {
  const currentUser = await requirePermission(PERMISSIONS.KITCHEN_TICKET_VIEW);

  return (
    <KitchenClient
      station={undefined}
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
