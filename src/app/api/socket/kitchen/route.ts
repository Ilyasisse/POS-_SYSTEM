import { NextRequest } from "next/server";
import type { KitchenSocketMessage } from "@/lib/kitchen-socket";

type KitchenClient = WebSocket;

const globalForKitchen = globalThis as unknown as {
  kitchenClients?: Set<KitchenClient>;
  kitchenTickets?: Array<{
    id: string;
    receiptNo: number;
    createdAt: string;
    status: "new" | "in_progress" | "done";
    note?: string;
    items: {
      id: string;
      name: string;
      quantity: number;
    }[];
  }>;
};

if (!globalForKitchen.kitchenClients) {
  globalForKitchen.kitchenClients = new Set();
}

if (!globalForKitchen.kitchenTickets) {
  globalForKitchen.kitchenTickets = [];
}

function broadcast(message: KitchenSocketMessage) {
  const serialized = JSON.stringify(message);

  for (const client of globalForKitchen.kitchenClients!) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

export async function GET(req: NextRequest) {
  const upgradeHeader = req.headers.get("upgrade");

  if (upgradeHeader !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req as unknown as Request);

  socket.onopen = () => {
    globalForKitchen.kitchenClients!.add(socket);

    const snapshot: KitchenSocketMessage = {
      type: "ORDER_SNAPSHOT",
      payload: globalForKitchen.kitchenTickets!.filter(
        (ticket) => ticket.status !== "done",
      ),
    };

    socket.send(JSON.stringify(snapshot));
  };

  socket.onmessage = (event:any) => {
    try {
      const message = JSON.parse(String(event.data)) as KitchenSocketMessage;

      if (message.type === "NEW_ORDER") {
        const incoming = message.payload;

        globalForKitchen.kitchenTickets = [
          incoming,
          ...globalForKitchen.kitchenTickets!.filter(
            (ticket) => ticket.id !== incoming.id,
          ),
        ];

        broadcast({
          type: "NEW_ORDER",
          payload: incoming,
        });

        return;
      }

      if (message.type === "UPDATE_ORDER_STATUS") {
        const { id, status } = message.payload;

        globalForKitchen.kitchenTickets = globalForKitchen.kitchenTickets!.map(
          (ticket) => (ticket.id === id ? { ...ticket, status } : ticket),
        );

        broadcast({
          type: "UPDATE_ORDER_STATUS",
          payload: { id, status },
        });
      }
    } catch (error) {
      console.error("Kitchen socket message error:", error);
    }
  };

  socket.onclose = () => {
    globalForKitchen.kitchenClients!.delete(socket);
  };

  socket.onerror = () => {
    globalForKitchen.kitchenClients!.delete(socket);
  };

  return response;
}
