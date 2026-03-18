import KitchenClient from "@/app/components/kitchen/KitchenClient";
import { requireRole } from "@/lib/auth/requireRole";

export default async function KitchenPage() {
  const currentUser = await requireRole(["KITCHEN", "BARISTA", "ADMIN"]);

  let station: "KITCHEN" | "BARISTA" | undefined;

  if (currentUser.role === "BARISTA") {
    station = "BARISTA";
  } else {
    station = "KITCHEN";
  }

  return (
    <KitchenClient
      station={station}
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}