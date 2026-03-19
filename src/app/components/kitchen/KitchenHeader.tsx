import SignOutButton from "../SignOutButton";
import {
  translateKitchenStationName,
  translateSocketStatus,
  translateUserRole,
} from "@/lib/ui-text";

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
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Bandhigga jikada
        </p>
        <h1 className="text-2xl font-bold">
          {station
            ? `Dalabaadka ${translateKitchenStationName(station)}`
            : "Dalabaadka tooska ah"}
        </h1>
      </div>

      <SignOutButton />

      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Waxaad ku gashay
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
          Saf {queueCount}
        </span>
      </div>
    </header>
  );
}
