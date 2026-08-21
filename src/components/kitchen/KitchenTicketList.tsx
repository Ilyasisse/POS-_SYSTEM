import type {
  KitchenTicket,
  KitchenTicketStatus,
} from "@/lib/kitchen/kitchen-socket";
import KitchenTicketCard from "./KitchenTicketCard";

type KitchenTicketListProps = {
  tickets?: readonly KitchenTicket[];
  onUpdateStatus: (id: string, status: KitchenTicketStatus) => void;
  canUpdateStatus?: boolean;
  onRecordQuality: (id: string, type: "LATE" | "REMAKE" | "WRONG_ORDER" | "WAITER_MISTAKE", reason: string) => void;
};

const EMPTY_TICKETS: readonly KitchenTicket[] = [];

export default function KitchenTicketList({
  tickets = EMPTY_TICKETS,
  onUpdateStatus,
  canUpdateStatus = true,
  onRecordQuality,
}: KitchenTicketListProps) {
  return (
    <section className="flex flex-col-reverse gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
      {tickets.map((ticket) => (
        <KitchenTicketCard
          key={ticket.id}
          ticket={ticket}
          onUpdateStatus={onUpdateStatus}
          canUpdateStatus={canUpdateStatus}
          onRecordQuality={onRecordQuality}
        />
      ))}
    </section>
  );
}
