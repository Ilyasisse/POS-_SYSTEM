import { notFound } from "next/navigation";
import KitchenClient from "@/components/kitchen/KitchenClient";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { stationFromPathSegment } from "@/lib/kitchen/kitchen-socket";

type KitchenStationPageProps = {
  params: Promise<{
    station: string;
  }>;
};

export default async function KitchenStationPage({
  params,
}: KitchenStationPageProps) {
  const { station: stationParam } = await params;
  const station = stationFromPathSegment(stationParam);

  if (!station) {
    notFound();
  }

  const currentUser = await requirePermission(
    PERMISSIONS.KITCHEN_TICKET_VIEW,
    { stations: [station] },
  );

  return (
    <KitchenClient
      station={station}
      currentUserId={currentUser.id}
      currentUserName={currentUser.fullName}
      currentUserRole={currentUser.role}
    />
  );
}
