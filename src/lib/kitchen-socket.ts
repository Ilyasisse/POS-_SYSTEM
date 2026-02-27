export type KitchenTicketStatus = "new" | "in_progress" | "done";

export type KitchenTicketItem = {
  id: string;
  name: string;
  quantity: number;
};

export type KitchenTicket = {
  id: string;
  receiptNo: number;
  createdAt: string;
  note: string | null;
  status: KitchenTicketStatus;
  items: KitchenTicketItem[];
};

export type SaleRecord = {
  id: string;
  receiptNo: number;
  waiterName: string;
  total: number;
  createdAt: string;
};

export type KitchenSocketMessage =
  | {
      type: "NEW_ORDER";
      payload: KitchenTicket;
    }
  | {
      type: "ORDER_SNAPSHOT";
      payload: KitchenTicket[];
    }
  | {
      type: "UPDATE_ORDER_STATUS";
      payload: {
        id: string;
        status: KitchenTicketStatus;
      };
    }
  | {
      type: "NEW_SALE";
      payload: SaleRecord;
    }
  | {
      type: "SALES_SNAPSHOT";
      payload: {
        day: string;
        sales: SaleRecord[];
      };
    };

export function getKitchenSocketUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_KITCHEN_WS_URL;
  if (configuredUrl && configuredUrl.trim().length > 0) {
    return configuredUrl.trim();
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname || "localhost";
    return `${protocol}://${host}:8080`;
  }
  return "ws://localhost:8080";
}
