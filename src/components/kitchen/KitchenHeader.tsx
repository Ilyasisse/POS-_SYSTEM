import Link from "next/link";
import {
  translateKitchenStationName,
  translateUserRole,
} from "@/lib/ui/ui-text";

type KitchenHeaderProps = {
  queueCount: number;
  station?: string;
  currentUserName: string;
  currentUserRole: string;
};

export default function KitchenHeader({
  queueCount,
  station,
  currentUserName,
  currentUserRole,
}: KitchenHeaderProps) {
  const canUseInventory = station === "CABITAAN" && currentUserRole !== "ADMIN";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Kitchen Screen
        </p>
        <h1 className="text-2xl font-bold">
          {station
            ? `${translateKitchenStationName(station)} Orders`
            : "Live Orders"}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canUseInventory ? (
          <Link
            prefetch={false}
            href="/inventory"
            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase text-white transition hover:bg-emerald-500"
          >
            Inventory
          </Link>
        ) : null}

        <div className="rounded-xl  border-border bg-card/70 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Welcome
          </p>
          <p className="text-sm font-semibold text-foreground">
            {currentUserName}
          </p>
          <p className="text-xs text-muted-foreground">
            {translateUserRole(currentUserRole)}
          </p>
        </div>

        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase">
          Queue {queueCount}
        </span>
      </div>
    </header>
  );
}
