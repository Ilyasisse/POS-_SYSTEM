import { requireRole } from "@/lib/auth/requireRole";
import KitchenClient from "@/app/components/kitchen/KitchenClient";

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