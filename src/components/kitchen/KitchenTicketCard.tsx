import { Button } from "@/components/ui/button";
import type {
  KitchenTicket,
  KitchenTicketStatus,
} from "@/lib/kitchen/kitchen-socket";
import { kitchenStatusColor } from "./kitchen-utils";
import { translateKitchenTicketStatus } from "@/lib/ui/ui-text";
import { formatPreparationDuration } from "@/lib/kitchen/kitchen-metrics";

type KitchenTicketCardProps = {
  ticket: KitchenTicket;
  onUpdateStatus: (id: string, status: KitchenTicketStatus) => void;
  canUpdateStatus?: boolean;
  onRecordQuality: (id: string, type: "LATE" | "REMAKE" | "WRONG_ORDER" | "WAITER_MISTAKE", reason: string) => void;
};

export default function KitchenTicketCard({
  ticket,
  onUpdateStatus,
  canUpdateStatus = true,
  onRecordQuality,
}: KitchenTicketCardProps) {
  const items = Array.isArray(ticket.items) ? ticket.items : [];
  const station = items[0]?.station;
  const metric = station ? ticket.stationMetrics[station] : null;

  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4 shadow-lg shadow-black/25">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-md font-semibold text-slate-300">
            Order #{ticket.orderNumber} · Round {ticket.roundNumber}
          </p>
          <p className="text-sm text-slate-400">
            {new Date(ticket.createdAt).toLocaleTimeString("en-US")}
          </p>
          {ticket.tableName ? (
            <p className="mt-1 text-lg font-bold text-emerald-300">
              Table: {ticket.tableName}
            </p>
          ) : null}
          {ticket.cashierName ? (
            <p className="mt-1 text-sm font-semibold text-slate-300">
              Cashier: {ticket.cashierName}
            </p>
          ) : null}
          {ticket.waiterName ? (
            <p className="mt-1 text-md font-semibold text-amber-300">
              Waiter: {ticket.waiterName}
            </p>
          ) : null}
          {metric ? (
            <p
              className={`mt-1 text-sm font-semibold ${metric.isLate ? "text-red-300" : "text-cyan-300"}`}
            >
              Prep: {formatPreparationDuration(metric.preparationSeconds)}
              {metric.targetMinutes ? ` / ${metric.targetMinutes}m target` : ""}
              {metric.isLate ? " · LATE" : ""}
            </p>
          ) : null}
        </div>

        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${kitchenStatusColor(ticket.status)}`}
        >
          {translateKitchenTicketStatus(ticket.status)}
        </span>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No items</p>
        ) : (
          items.map((item) => (
            <div
              key={`${ticket.id}-${item.id}`}
              className="rounded-lg bg-slate-700/60 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-100">
                  {item.name}
                </p>
                <p className="text-sm font-bold text-blue-300">
                  x{item.quantity}
                </p>
              </div>

              {item.modifiers.length > 0 ? (
                <div className="mt-2 space-y-1 rounded-md bg-slate-800/70 px-2 py-2">
                  {item.modifiers.map((modifier) => (
                    <div
                      key={`${item.id}-${modifier.id}`}
                      className="flex items-center justify-between text-xs text-slate-300"
                    >
                      <span>+ {modifier.name}</span>
                      <span>x{modifier.qty}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {ticket.note ? (
        <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-900/25 px-3 py-2 text-xs text-amber-200">
          Note: {ticket.note}
        </p>
      ) : null}

      {canUpdateStatus ? (
        <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {ticket.status === "new" ? (
            <Button
              type="button"
              onClick={() => onUpdateStatus(ticket.id, "in_progress")}
              className="min-h-11 rounded-lg bg-blue-600 text-sm font-semibold text-white"
            >
              Bilow
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => onUpdateStatus(ticket.id, "new")}
              className="min-h-11 rounded-lg bg-slate-600 text-sm font-semibold text-white"
            >
              Dib fur
            </Button>
          )}

          <Button
            type="button"
            onClick={() => onUpdateStatus(ticket.id, "done")}
            className="min-h-11 rounded-lg bg-green-600 text-sm font-semibold text-white"
          >
            Dhammaay
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-700 pt-3">
          {(["LATE", "REMAKE", "WRONG_ORDER", "WAITER_MISTAKE"] as const).map((type) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              className="min-h-9 border-slate-600 bg-transparent text-xs text-slate-200"
              onClick={() => {
                const reason = window.prompt(`Reason for ${type.replaceAll("_", " ").toLowerCase()}:`);
                if (reason?.trim()) onRecordQuality(ticket.id, type, reason);
              }}
            >
              {type.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400">
          Open a specific station queue to update this ticket.
        </p>
      )}
    </article>
  );
}
