import { requireRole } from "@/lib/auth/requireRole";
import KitchenClient from "@/app/components/kitchen/KitchenClient";

export default async function CabitaanPage() {
  const currentUser = await requireRole(["COOK", "ADMIN"], ["CABITAAN"]);

  return (
    <KitchenClient
      station="CABITAAN"
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
