import { requireRole } from "@/lib/auth/require-role";
import KitchenClient from "@/components/kitchen/KitchenClient";

export default async function CabitaanPage() {
  const currentUser = await requireRole(["COOK", "Cabitaan", "ADMIN"], ["CABITAAN"]);

  return (
    <KitchenClient
      station="CABITAAN"
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
