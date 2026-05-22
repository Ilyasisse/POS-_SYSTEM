import { requireRole } from "@/lib/auth/requireRole";
import WaiterPickupPage from "@/app/components/waiter/WaiterPickupPage";

export default async function WaiterOrdersPage() {
  const currentUser = await requireRole(["WAITER", "ADMIN"]);

  return (
    <WaiterPickupPage
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
