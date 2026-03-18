import type {
  KitchenTicket,
  KitchenTicketStatus,
} from "@/lib/kitchen-socket";
import KitchenTicketCard from "./KitchenTicketCard";

type KitchenTicketListProps = {
  tickets?: KitchenTicket[];
  onUpdateStatus: (id: string, status: KitchenTicketStatus) => void;
};

export default function KitchenTicketList({
  tickets = [],
  onUpdateStatus,
}: KitchenTicketListProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tickets.map((ticket) => (
        <KitchenTicketCard
          key={ticket.id}
          ticket={ticket}
          onUpdateStatus={onUpdateStatus}
        />
      ))}
    </section>
  );
}