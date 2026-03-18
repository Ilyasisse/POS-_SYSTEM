export type KitchenTicketStatus = "new" | "in_progress" | "done";

export type KitchenStation = "KITCHEN" | "BARISTA";

export type KitchenTicketItem = {
  id: string;
  name: string;
  quantity: number;
  station: KitchenStation;
};

export type KitchenTicket = {
  id: string;
  orderId: string;
  orderNumber: number;
  createdAt: string;
  status: KitchenTicketStatus;
  note?: string;
  assignedBaristaId?: string | null;
  items: KitchenTicketItem[];
};

export type KitchenSocketMessage =
  | {
      type: "ORDER_SNAPSHOT";
      payload: KitchenTicket[];
    }
  | {
      type: "NEW_ORDER";
      payload: KitchenTicket;
    }
  | {
      type: "UPDATE_ORDER_STATUS";
      payload: {
        id: string;
        status: KitchenTicketStatus;
      };
    };

export function getKitchenSocketUrl(station?: string) {
  const base =
    process.env.NEXT_PUBLIC_KITCHEN_SOCKET_URL ?? "ws://localhost:3001";

  if (!station) return `${base}/api/kitchen/ws`;

  return `${base}/api/kitchen/ws?station=${encodeURIComponent(station)}`;
}