import { requireRole } from "@/lib/auth/require-role";
import KitchenClient from "@/components/kitchen/KitchenClient";

export default async function FastFoodPage() {
  const currentUser = await requireRole(["COOK", "ADMIN"], ["FAST_FOOD"]);

  return (
    <KitchenClient
      station="FAST_FOOD"
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}