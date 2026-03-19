import { notFound } from "next/navigation";
import KitchenClient from "../../components/kitchen/KitchenClient";
import { requireRole } from "@/lib/auth/requireRole";
import { stationFromPathSegment } from "@/lib/kitchen-socket";

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

  const currentUser = await requireRole(
    ["ADMIN", "BARISTA", "COOK", "Cabitaan"],
    [station]
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
