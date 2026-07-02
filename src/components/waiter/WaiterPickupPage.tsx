"use client";

import { Button } from "@/components/ui/button";

import type { KitchenTicket } from "@/lib/kitchen/kitchen-socket";
import { useKitchenSocket } from "@/hooks/kitchen/useKitchenSocket";
import { translateSocketStatus } from "@/lib/ui/ui-text";

type WaiterPickupPageProps = {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isClaimedByCurrentUser(
  ticket: KitchenTicket,
  currentUserId: string,
  currentUserRole: string,
) {
  return (
    currentUserRole === "ADMIN" ||
    !ticket.claimedByWaiterId ||
    ticket.claimedByWaiterId === currentUserId
  );
}

export default function WaiterPickupPage({
  currentUserId,
  currentUserName,
  currentUserRole,
}: WaiterPickupPageProps) {
  const { activeTickets, socketStatus, statusMessage, updatePickupStatus } =
    useKitchenSocket({
      currentUserId,
      currentUserName,
      currentUserRole,
    });

  return (
    <div
      className="min-h-screen bg-muted/35 px-4 py-6 text-foreground md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <header className="rounded-2xl border border-border bg-card p-5 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Waiter pickup display</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ready kitchen orders to claim and deliver to tables.
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {currentUserName}
              </p>
            </div>

            <div className="flex items-start gap-2 text-right">
              <div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    socketStatus === "connected"
                      ? "bg-green-100 text-green-700"
                      : socketStatus === "connecting"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {translateSocketStatus(socketStatus)}
                </span>
                <p className="mt-2 text-sm text-muted-foreground">
                  {activeTickets.length} ready order(s)
                </p>
              </div>
            </div>
          </div>
        </header>

        {statusMessage ? (
          <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            {statusMessage}
          </p>
        ) : null}

        {activeTickets.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-border bg-card/80 p-10 text-center shadow-sm">
            <h2 className="text-xl font-bold text-foreground">
              No ready orders
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Orders appear here after every kitchen station marks its work
              done.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeTickets.map((ticket) => {
              const canDeliver = isClaimedByCurrentUser(
                ticket,
                currentUserId,
                currentUserRole,
              );
              const isClaimed = ticket.pickupStatus === "claimed";
              const claimedByOther =
                isClaimed &&
                Boolean(ticket.claimedByWaiterId) &&
                ticket.claimedByWaiterId !== currentUserId &&
                currentUserRole !== "ADMIN";

              return (
                <article
                  key={ticket.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">
                        Order #{ticket.orderNumber}
                      </p>
                      <h2 className="mt-1 text-2xl font-bold text-foreground">
                        Table {ticket.tableName ?? "-"}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ready at {formatTime(ticket.createdAt)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                        isClaimed
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {isClaimed ? "claimed" : "ready"}
                    </span>
                  </div>

                  {ticket.claimedByWaiterName ? (
                    <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                      Claimed by {ticket.claimedByWaiterName}
                    </p>
                  ) : null}

                  {ticket.note ? (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Note: {ticket.note}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {ticket.items.map((item) => (
                      <div
                        key={`${ticket.id}-${item.id}`}
                        className="rounded-xl bg-muted px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-foreground">
                            {item.name}
                          </p>
                          <p className="font-bold text-blue-700">
                            x{item.quantity}
                          </p>
                        </div>
                        {item.modifiers.length > 0 ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {item.modifiers.map((modifier) => (
                              <p key={`${item.id}-${modifier.id}`}>
                                + {modifier.name} x{modifier.qty}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      disabled={isClaimed}
                      onClick={() => updatePickupStatus(ticket.id, "claimed")}
                      className="min-h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Claim
                    </Button>
                    <Button
                      type="button"
                      disabled={!canDeliver || claimedByOther}
                      onClick={() => updatePickupStatus(ticket.id, "delivered")}
                      className="min-h-11 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Delivered
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
