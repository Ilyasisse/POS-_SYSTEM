import KitchenClient from "../../components/kitchen/KitchenClient";

type KitchenStationPageProps = {
  params: {
    station: string;
  };
};

export default function KitchenStationPage({
  params,
}: KitchenStationPageProps) {
  return <KitchenClient station={params.station} />;
}