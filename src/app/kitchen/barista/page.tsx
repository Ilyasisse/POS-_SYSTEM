import { requireRole } from "@/lib/auth/requireRole";
import KitchenClient from "@/app/components/kitchen/KitchenClient";

export default async function BaristaPage() {
  const currentUser = await requireRole(["BARISTA", "ADMIN"], ["BARISTA"]);

  return (
    <KitchenClient
      station="BARISTA"
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
