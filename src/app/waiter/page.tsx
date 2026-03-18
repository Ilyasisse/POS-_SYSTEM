import { requireRole } from "@/lib/auth/requireRole";
import WaiterPage from "@/app/components/waiter/WaiterPage";

export default async function WaiterRoutePage() {
  await requireRole(["WAITER", "ADMIN"]);
  return <WaiterPage />;
}