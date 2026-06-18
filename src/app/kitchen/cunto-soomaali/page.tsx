import { requireRole } from "@/lib/auth/require-role";
import KitchenClient from "@/components/kitchen/KitchenClient";

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
