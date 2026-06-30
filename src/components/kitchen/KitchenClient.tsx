"use client";

import type {
  KitchenStation,
  KitchenTicket,
} from "@/lib/kitchen/kitchen-socket";
import KitchenEmptyState from "./KitchenEmptyState";
import KitchenHeader from "./KitchenHeader";
import KitchenStatusBanner from "./KitchenStatusBanner";
import KitchenTicketList from "./KitchenTicketList";
import { useKitchenSocket } from "@/hooks/kitchen/useKitchenSocket";

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
  const { activeTickets, socketStatus, statusMessage, updateTicketStatus } =
    useKitchenSocket({
      station,
      currentUserId,
      currentUserName,
      currentUserRole,
    });

  const visibleTickets: KitchenTicket[] = activeTickets;
  const canUpdateStatus = Boolean(station);

  return (
    <main
      className="dark min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-slate-100 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <KitchenHeader
          socketStatus={socketStatus}
          queueCount={visibleTickets.length}
          station={station}
          currentUserName={currentUserName}
          currentUserRole={currentUserRole}
        />

        <KitchenStatusBanner message={statusMessage} />

        {visibleTickets.length === 0 ? (
          <KitchenEmptyState />
        ) : (
          <KitchenTicketList
            tickets={visibleTickets}
            onUpdateStatus={updateTicketStatus}
            canUpdateStatus={canUpdateStatus}
          />
        )}
      </div>
    </main>
  );
}
