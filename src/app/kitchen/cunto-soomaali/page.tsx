import { requireRole } from "@/lib/auth/requireRole";
import KitchenClient from "@/app/components/kitchen/KitchenClient";

export default async function CuntoSoomaaliKitchenPage() {
  const currentUser = await requireRole(["COOK", "ADMIN"], ["CUNTO_SOOMAALI"]);

  return (
    <KitchenClient
      station="CUNTO_SOOMAALI"
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
