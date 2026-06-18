import { requireRole } from "@/lib/auth/require-role";
import WaiterPickupPage from "@/components/waiter/WaiterPickupPage";

export default async function Page() {
  const currentUser = await requireRole(["WAITER", "ADMIN"]);

  return (
    <WaiterPickupPage
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
