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
  onRecordQuality: (
    id: string,
    type: "LATE" | "REMAKE" | "WRONG_ORDER" | "WAITER_MISTAKE",
    reason: string,
  ) => void;
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
    <article className="rounded-2xl border border-border bg-card/70 p-4 shadow-lg shadow-black/25">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-md font-semibold text-muted-foreground">
            Order #{ticket.orderNumber} · Round {ticket.roundNumber}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date(ticket.createdAt).toLocaleTimeString("en-US")}
          </p>
          {ticket.tableName ? (
            <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
              Table: {ticket.tableName}
            </p>
          ) : null}
          {ticket.cashierName ? (
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Cashier: {ticket.cashierName}
            </p>
          ) : null}
          {ticket.waiterName ? (
            <p className="mt-1 text-md font-semibold text-amber-700 dark:text-amber-300">
              Waiter: {ticket.waiterName}
            </p>
          ) : null}
          {metric ? (
            <p
              className={`mt-1 text-sm font-semibold ${metric.isLate ? "text-red-700 dark:text-red-300" : "text-cyan-700 dark:text-cyan-300"}`}
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
          <p className="text-sm text-muted-foreground">No items</p>
        ) : (
          items.map((item) => (
            <div
              key={`${ticket.id}-${item.id}`}
              className="rounded-lg bg-muted/60 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {item.name}
                </p>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  x{item.quantity}
                </p>
              </div>

              {item.modifiers.length > 0 ? (
                <div className="mt-2 space-y-1 rounded-md bg-card/70 px-2 py-2">
                  {item.modifiers.map((modifier) => (
                    <div
                      key={`${item.id}-${modifier.id}`}
                      className="flex items-center justify-between text-xs text-muted-foreground"
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
        <p className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
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
                className="min-h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
              >
                Bilow
              </Button>
            ) : (
              <Button
                variant="outline"
                type="button"
                onClick={() => onUpdateStatus(ticket.id, "new")}
                className="min-h-11 rounded-lg bg-muted text-sm font-semibold text-foreground hover:bg-accent"
              >
                Dib fur
              </Button>
            )}

            <Button
              type="button"
              onClick={() => onUpdateStatus(ticket.id, "done")}
              className="min-h-11 rounded-lg bg-green-600 hover:bg-green-600/90 text-sm font-semibold text-white"
            >
              Dhammaay
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
            {(["LATE", "REMAKE", "WRONG_ORDER", "WAITER_MISTAKE"] as const).map(
              (type) => (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  className="min-h-9 border-border bg-transparent text-xs text-foreground"
                  onClick={() => {
                    const reason = window.prompt(
                      `Reason for ${type.replaceAll("_", " ").toLowerCase()}:`,
                    );
                    if (reason?.trim())
                      onRecordQuality(ticket.id, type, reason);
                  }}
                >
                  {type.replaceAll("_", " ")}
                </Button>
              ),
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Open a specific station queue to update this ticket.
        </p>
      )}
    </article>
  );
}
