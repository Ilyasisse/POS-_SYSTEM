import { requireRole } from "@/lib/auth/requireRole";
import WaiterPage from "@/app/components/waiter/WaiterPage";

export default async function Page() {
  const currentUser = await requireRole(["WAITER", "ADMIN"]);

  return <WaiterPage fullName={currentUser.fullName} />;
}