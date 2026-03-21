import type {
  KitchenTicket,
  KitchenTicketStatus,
} from "@/lib/kitchen-socket";
import KitchenTicketCard from "./KitchenTicketCard";

type KitchenTicketListProps = {
  tickets?: KitchenTicket[];
  onUpdateStatus: (id: string, status: KitchenTicketStatus) => void;
  canUpdateStatus?: boolean;
};

export default function KitchenTicketList({
  tickets = [],
  onUpdateStatus,
  canUpdateStatus = true,
}: KitchenTicketListProps) {
  return (
    <section className="flex flex-col-reverse gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
      {tickets.map((ticket) => (
        <KitchenTicketCard
          key={ticket.id}
          ticket={ticket}
          onUpdateStatus={onUpdateStatus}
          canUpdateStatus={canUpdateStatus}
        />
      ))}
    </section>
  );
}
