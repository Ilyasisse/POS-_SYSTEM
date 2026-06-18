import KitchenClient from "@/components/kitchen/KitchenClient";
import { requireRole } from "@/lib/auth/require-role";

export default async function KitchenPage() {
  const currentUser = await requireRole(["COOK", "BARISTA", "Cabitaan", "ADMIN"]);

  return (
    <KitchenClient
      station={undefined}
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
