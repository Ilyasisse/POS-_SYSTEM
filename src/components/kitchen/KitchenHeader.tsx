import Link from "next/link";
import {
  translateKitchenStationName,
  translateSocketStatus,
  translateUserRole,
} from "@/lib/ui/ui-text";

type KitchenHeaderProps = {
  socketStatus: "connecting" | "connected" | "disconnected";
  queueCount: number;
  station?: string;
  currentUserName: string;
  currentUserRole: string;
};

export default function KitchenHeader({
  socketStatus,
  queueCount,
  station,
  currentUserName,
  currentUserRole,
}: KitchenHeaderProps) {
  const canUseInventory = station === "CABITAAN" && currentUserRole !== "ADMIN";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
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
            href="/inventory"
            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase text-white transition hover:bg-emerald-500"
          >
            Inventory
          </Link>
        ) : null}

        <div className="rounded-xl  border-slate-700 bg-slate-900/70 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Welcome
          </p>
          <p className="text-sm font-semibold text-slate-100">
            {currentUserName}
          </p>
          <p className="text-xs text-slate-400">
            {translateUserRole(currentUserRole)}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
            socketStatus === "connected"
              ? "bg-green-900/60 text-green-300"
              : socketStatus === "connecting"
                ? "bg-amber-900/60 text-amber-300"
                : "bg-red-900/60 text-red-300"
          }`}
        >
          {translateSocketStatus(socketStatus)}
        </span>

        <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold uppercase">
          Queue {queueCount}
        </span>
      </div>
    </header>
  );
}
