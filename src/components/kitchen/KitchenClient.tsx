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
import { searchKitchenTickets } from "@/lib/kitchen/kitchen-ticket-search";

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
  const [search, setSearch] = useState("");
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

  const visibleTickets: KitchenTicket[] = searchKitchenTickets(
    activeTickets,
    search,
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
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
            <label
              htmlFor="kitchen-ticket-search"
              className="min-w-48 flex-1 text-sm font-semibold text-slate-200"
            >
              Find an active ticket
              <input
                id="kitchen-ticket-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order number, table or item"
                className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-base text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              />
            </label>
            {search.trim() ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700"
              >
                Clear search
              </button>
            ) : null}
            <span role="status" className="w-full text-sm text-slate-400">
              {visibleTickets.length} of {activeTickets.length} active tickets
              shown
            </span>
          </div>
        ) : null}

        {activeTickets.length === 0 ? (
          <KitchenEmptyState />
        ) : visibleTickets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/40 p-8 text-center text-slate-200">
            No active tickets match your search. Try another order number, table
            or item.
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
