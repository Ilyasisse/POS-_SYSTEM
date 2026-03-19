import KitchenClient from "@/app/components/kitchen/KitchenClient";
import { requireRole } from "@/lib/auth/requireRole";

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
