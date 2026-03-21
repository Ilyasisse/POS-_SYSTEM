import type {
  KitchenTicket,
  KitchenTicketStatus,
} from "@/lib/kitchen-socket";
import { kitchenStatusColor } from "./kitchen-utils";
import { translateKitchenTicketStatus } from "@/lib/ui-text";

type KitchenTicketCardProps = {
  ticket: KitchenTicket;
  onUpdateStatus: (id: string, status: KitchenTicketStatus) => void;
  canUpdateStatus?: boolean;
};

export default function KitchenTicketCard({
  ticket,
  onUpdateStatus,
  canUpdateStatus = true,
}: KitchenTicketCardProps) {
  const items = Array.isArray(ticket.items) ? ticket.items : [];

  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4 shadow-lg shadow-black/25">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-md font-semibold text-slate-300">
            Ticket #{ticket.orderNumber}
          </p>
          <p className="text-sm text-slate-400">
            {new Date(ticket.createdAt).toLocaleTimeString("en-US")}
          </p>
          {ticket.waiterName ? (
            <p className="mt-1 text-md font-semibold text-amber-300">
              Waiter: {ticket.waiterName}
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
                <p className="text-sm font-bold text-blue-300">x{item.quantity}</p>
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
        <div className="mt-4 grid grid-cols-2 gap-2">
          {ticket.status === "new" ? (
            <button
              type="button"
              onClick={() => onUpdateStatus(ticket.id, "in_progress")}
              className="min-h-11 rounded-lg bg-blue-600 text-sm font-semibold text-white"
            >
              Bilow
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdateStatus(ticket.id, "new")}
              className="min-h-11 rounded-lg bg-slate-600 text-sm font-semibold text-white"
            >
              Dib fur
            </button>
          )}

          <button
            type="button"
            onClick={() => onUpdateStatus(ticket.id, "done")}
            className="min-h-11 rounded-lg bg-green-600 text-sm font-semibold text-white"
          >
            Dhammaay
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400">
          Open a specific station queue to update this ticket.
        </p>
      )}
    </article>
  );
}
