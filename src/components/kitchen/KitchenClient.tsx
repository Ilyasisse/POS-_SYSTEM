"use client";

import { useState } from "react";

import type {
  KitchenStation,
  KitchenTicket,
} from "@/lib/kitchen/kitchen-socket";
import KitchenEmptyState from "./KitchenEmptyState";
import KitchenHeader from "./KitchenHeader";
import KitchenStatusBanner from "./KitchenStatusBanner";
import KitchenTicketList from "./KitchenTicketList";
import { useKitchenTickets } from "@/hooks/kitchen/useKitchenTickets";
import {
  filterKitchenTicketsByStatus,
  type KitchenStatusView,
} from "@/lib/kitchen/kitchen-status-filter";

type KitchenClientProps = {
  station?: KitchenStation;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
};

export default function KitchenClient({
  station,
  currentUserId,
  currentUserName,
  currentUserRole,
}: KitchenClientProps) {
  const [statusView, setStatusView] = useState<KitchenStatusView>("all");
  const {
    activeTickets,
    statusMessage,
    updateTicketStatus,
    recordQualityEvent,
  } = useKitchenTickets({
    station,
    currentUserId,
    currentUserName,
    currentUserRole,
  });

  const visibleTickets: KitchenTicket[] = filterKitchenTicketsByStatus(
    activeTickets,
    statusView,
    station,
  );
  const canUpdateStatus = Boolean(station);

  return (
    <div
      className="dark min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-slate-100 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <KitchenHeader
          queueCount={activeTickets.length}
          station={station}
          currentUserName={currentUserName}
          currentUserRole={currentUserRole}
        />

        <KitchenStatusBanner message={statusMessage} />

        {activeTickets.length > 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
            <p className="text-sm font-semibold text-slate-200">
              Focus the queue
            </p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Ticket status view"
            >
              {(
                [
                  ["all", "All tickets"],
                  ["new", "New"],
                  ["in_progress", "In progress"],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setStatusView(view)}
                  aria-pressed={statusView === view}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${statusView === view ? "bg-amber-400 text-slate-950" : "bg-slate-700 text-slate-100 hover:bg-slate-600"}`}
                >
                  {label} (
                  {
                    filterKitchenTicketsByStatus(activeTickets, view, station)
                      .length
                  }
                  )
                </button>
              ))}
            </div>
            <p role="status" className="mt-3 text-sm text-slate-400">
              Showing {visibleTickets.length} of {activeTickets.length} active
              tickets
            </p>
          </div>
        ) : null}

        {activeTickets.length === 0 ? (
          <KitchenEmptyState />
        ) : visibleTickets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/40 p-8 text-center text-slate-200">
            No active tickets have this status. Choose All tickets to see the
            full queue.
          </p>
        ) : (
          <KitchenTicketList
            tickets={visibleTickets}
            onUpdateStatus={updateTicketStatus}
            canUpdateStatus={canUpdateStatus}
            onRecordQuality={recordQualityEvent}
          />
        )}
      </div>
    </div>
  );
}
