import { notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { kitchenStationLabel } from "@/lib/kitchen/kitchen-print";
import {
  getPrintableKitchenTicket,
} from "@/lib/kitchen/kitchen-tickets";
import {
  normalizeKitchenStation,
  type KitchenStation,
} from "@/lib/kitchen/kitchen-socket";
import PrintButton from "./PrintButton";

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Africa/Nairobi",
});

export default async function PrintableKitchenTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ station?: string }>;
}) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const requestedStation = query.station
    ? normalizeKitchenStation(query.station)
    : undefined;
  if (query.station && !requestedStation) notFound();

  const currentUser = await requirePermission(
    PERMISSIONS.KITCHEN_TICKET_VIEW,
    requestedStation ? { stations: [requestedStation] } : undefined,
  );
  const ticket = await getPrintableKitchenTicket(
    currentUser,
    orderId,
    requestedStation,
  );
  if (!ticket) notFound();

  const stations = [
    ...new Set(ticket.items.map((item) => item.station)),
  ] as KitchenStation[];
  const title =
    stations.length === 1
      ? kitchenStationLabel(stations[0])
      : "All kitchen stations";

  return (
    <main className="min-h-dvh bg-muted/30 p-4 text-black print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-sm justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="mx-auto max-w-sm bg-white p-6 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em]">
            Kitchen ticket
          </p>
          <h1 className="mt-1 text-2xl font-black">{title}</h1>
          <p className="mt-2 text-lg font-bold">
            Order #{ticket.orderNumber} · Round {ticket.roundNumber}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-dashed border-black py-3 text-xs">
          <div>
            <dt className="font-bold uppercase">Sent</dt>
            <dd>{dateTime.format(new Date(ticket.createdAt))}</dd>
          </div>
          <div className="text-right">
            <dt className="font-bold uppercase">Table / service</dt>
            <dd>{ticket.tableName ?? "Counter"}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase">Waiter</dt>
            <dd>{ticket.waiterName ?? "—"}</dd>
          </div>
          <div className="text-right">
            <dt className="font-bold uppercase">Cashier</dt>
            <dd>{ticket.cashierName ?? "—"}</dd>
          </div>
        </dl>

        <section className="divide-y divide-dashed divide-black border-b-2 border-black">
          {ticket.items.map((item) => (
            <div key={item.id} className="py-4">
              <div className="grid grid-cols-[auto_1fr] gap-3 text-xl font-black">
                <span>{item.quantity}×</span>
                <span>{item.name}</span>
              </div>
              {stations.length > 1 ? (
                <p className="ml-10 mt-1 text-xs font-bold uppercase">
                  {kitchenStationLabel(item.station)}
                </p>
              ) : null}
              {item.modifiers.length ? (
                <ul className="ml-10 mt-2 list-disc space-y-1 text-sm font-semibold">
                  {item.modifiers.map((modifier) => (
                    <li key={modifier.id}>
                      {modifier.qty}× {modifier.name}
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.assignedUserName ? (
                <p className="ml-10 mt-2 text-xs">
                  Assigned: <strong>{item.assignedUserName}</strong>
                </p>
              ) : null}
            </div>
          ))}
        </section>

        {ticket.note ? (
          <section className="border-b-2 border-black py-4">
            <h2 className="text-xs font-black uppercase">Special instructions</h2>
            <p className="mt-1 text-lg font-bold">{ticket.note}</p>
          </section>
        ) : null}

        <footer className="pt-3 text-center text-xs">
          Ticket #{ticket.ticketNumber} · {ticket.status.replace("_", " ").toUpperCase()}
        </footer>
      </article>
    </main>
  );
}
