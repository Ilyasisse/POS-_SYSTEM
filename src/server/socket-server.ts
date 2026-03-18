import { WebSocketServer, WebSocket } from "ws";
import type {
  KitchenSocketMessage,
  KitchenTicket,
} from "../lib/kitchen-socket";

const wss = new WebSocketServer({ port: 3001 });

let tickets: KitchenTicket[] = [];

function broadcast(message: KitchenSocketMessage) {
  const data = JSON.stringify(message);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

wss.on("connection", (ws) => {
  console.log("Socket client connected");

  const snapshotMessage: KitchenSocketMessage = {
    type: "ORDER_SNAPSHOT",
    payload: tickets.filter((ticket) => ticket.status !== "done"),
  };

  ws.send(JSON.stringify(snapshotMessage));

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as KitchenSocketMessage;

      if (message.type === "NEW_ORDER") {
        const incoming = message.payload;

        tickets = [incoming, ...tickets.filter((ticket) => ticket.id !== incoming.id)];

        broadcast({
          type: "NEW_ORDER",
          payload: incoming,
        });

        return;
      }

      if (message.type === "UPDATE_ORDER_STATUS") {
        const { id, status } = message.payload;

        tickets = tickets
          .map((ticket) =>
            ticket.id === id ? { ...ticket, status } : ticket
          )
          .filter((ticket) => ticket.status !== "done");

        broadcast({
          type: "UPDATE_ORDER_STATUS",
          payload: { id, status },
        });
      }
    } catch (error) {
      console.error("Socket message error:", error);
    }
  });

  ws.on("close", () => {
    console.log("Socket client disconnected");
  });

  ws.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

console.log("Kitchen websocket server running on ws://localhost:3001");
