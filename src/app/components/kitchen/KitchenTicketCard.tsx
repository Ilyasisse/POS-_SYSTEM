import type {
  KitchenTicket,
  KitchenTicketStatus,
} from "@/lib/kitchen-socket";
import { kitchenStatusColor } from "./kitchen-utils";

type KitchenTicketCardProps = {
  ticket: KitchenTicket;
  onUpdateStatus: (id: string, status: KitchenTicketStatus) => void;
};

export default function KitchenTicketCard({
  ticket,
  onUpdateStatus,
}: KitchenTicketCardProps) {
  const items = Array.isArray(ticket.items) ? ticket.items : [];

  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4 shadow-lg shadow-black/25">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">
            Ticket #{ticket.orderNumber}
          </p>
          <p className="text-xs text-slate-400">
            {new Date(ticket.createdAt).toLocaleTimeString("en-US")}
          </p>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${kitchenStatusColor(ticket.status)}`}
        >
          {ticket.status.replace("_", " ")}
        </span>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No items</p>
        ) : (
          items.map((item) => (
            <div
              key={`${ticket.id}-${item.id}`}
              className="flex items-center justify-between rounded-lg bg-slate-700/60 px-3 py-2"
            >
              <p className="text-sm font-semibold text-slate-100">{item.name}</p>
              <p className="text-sm font-bold text-blue-300">x{item.quantity}</p>
            </div>
          ))
        )}
      </div>

      {ticket.note ? (
        <p className="mt-3 rounded-lg border border-amber-700/50 bg-amber-900/25 px-3 py-2 text-xs text-amber-200">
          Note: {ticket.note}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {ticket.status === "new" ? (
          <button
            type="button"
            onClick={() => onUpdateStatus(ticket.id, "in_progress")}
            className="min-h-11 rounded-lg bg-blue-600 text-sm font-semibold text-white"
          >
            Start
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onUpdateStatus(ticket.id, "new")}
            className="min-h-11 rounded-lg bg-slate-600 text-sm font-semibold text-white"
          >
            Reopen
          </button>
        )}

        <button
          type="button"
          onClick={() => onUpdateStatus(ticket.id, "done")}
          className="min-h-11 rounded-lg bg-green-600 text-sm font-semibold text-white"
        >
          Done
        </button>
      </div>
    </article>
  );
}