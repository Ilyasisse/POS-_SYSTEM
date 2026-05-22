import { WebSocketServer, WebSocket } from "ws";
import type {
  KitchenSocketMessage,
  KitchenTicket,
  KitchenTicketFilter,
} from "../lib/kitchen-socket";
import {
  filterKitchenTicketsByStation,
  getKitchenTicketStatusForItems,
  normalizeKitchenTicket,
  normalizeKitchenStation,
  setKitchenTicketPickupStatus,
  setKitchenTicketStationStatus,
} from "../lib/kitchen-socket";

const wss = new WebSocketServer({ port: 3001 });

let tickets: KitchenTicket[] = [];
const clientFilters = new WeakMap<WebSocket, KitchenTicketFilter>();

function resolveClientFilter(requestUrl?: string | null): KitchenTicketFilter {
  const url = new URL(requestUrl ?? "/", "ws://localhost:3001");

  return {
    station: url.searchParams.get("station"),
    userId: url.searchParams.get("userId"),
    role: url.searchParams.get("role"),
  };
}

function send(client: WebSocket, message: KitchenSocketMessage) {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }

  client.send(JSON.stringify(message));
}

function sendSnapshot(client: WebSocket) {
  const filter = clientFilters.get(client);

  send(client, {
    type: "ORDER_SNAPSHOT",
    payload: filterKitchenTicketsByStation(tickets, filter),
  });
}

function broadcastTicket(ticket: KitchenTicket) {
  for (const client of wss.clients) {
    const filter = clientFilters.get(client);
    const filteredTicket = filterKitchenTicketsByStation([ticket], filter)[0];

    if (!filteredTicket) {
      continue;
    }

    send(client, {
      type: "NEW_ORDER",
      payload: filteredTicket,
    });
  }
}

function broadcastStatus(message: KitchenSocketMessage) {
  for (const client of wss.clients) {
    send(client, message);
  }
}

wss.on("connection", (ws, request) => {
  const filter = resolveClientFilter(request.url);

  clientFilters.set(ws, filter);
  sendSnapshot(ws);

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as KitchenSocketMessage;

      if (message.type === "NEW_ORDER") {
        const incoming = normalizeKitchenTicket(message.payload);

        if (!incoming) {
          return;
        }

        tickets = [incoming, ...tickets.filter((ticket) => ticket.id !== incoming.id)];
        broadcastTicket(incoming);
        return;
      }

      if (message.type === "ORDER_SNAPSHOT") {
        const incomingTickets = Array.isArray(message.payload)
          ? message.payload
              .map(normalizeKitchenTicket)
              .filter((ticket): ticket is KitchenTicket => ticket !== null)
          : [];

        tickets = incomingTickets;

        for (const client of wss.clients) {
          sendSnapshot(client);
        }

        return;
      }

      if (message.type === "UPDATE_ORDER_STATUS") {
        const { id, station, status } = message.payload;
        const normalizedStation = normalizeKitchenStation(station);

        if (!normalizedStation) {
          return;
        }

        const previousTicket = tickets.find((ticket) => ticket.id === id);
        const nextTicket = previousTicket
          ? setKitchenTicketStationStatus(previousTicket, normalizedStation, status)
          : null;

        tickets = tickets.map((ticket) =>
          ticket.id === id && nextTicket ? nextTicket : ticket,
        );

        broadcastStatus({
          type: "UPDATE_ORDER_STATUS",
          payload: { id, station: normalizedStation, status },
        });

        if (nextTicket && getKitchenTicketStatusForItems(nextTicket) === "done") {
          broadcastTicket(nextTicket);
        }
      }

      if (message.type === "UPDATE_PICKUP_STATUS") {
        const {
          id,
          pickupStatus,
          claimedByWaiterId,
          claimedByWaiterName,
        } = message.payload;
        const previousTicket = tickets.find((ticket) => ticket.id === id);

        if (!previousTicket) {
          return;
        }

        const nextTicket = setKitchenTicketPickupStatus(
          previousTicket,
          pickupStatus,
          claimedByWaiterId,
          claimedByWaiterName,
        );

        tickets =
          pickupStatus === "delivered"
            ? tickets.filter((ticket) => ticket.id !== id)
            : tickets.map((ticket) => (ticket.id === id ? nextTicket : ticket));

        broadcastStatus({
          type: "UPDATE_PICKUP_STATUS",
          payload: {
            id,
            pickupStatus,
            claimedByWaiterId,
            claimedByWaiterName,
          },
        });
      }
    } catch (error) {
      console.error("Socket message error:", error);
    }
  });

  ws.on("close", () => {
    clientFilters.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

console.log("Kitchen websocket server running on ws://localhost:3001");
