import http from "http";
import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";

const activeTickets = new Map();
const clientFilters = new WeakMap();

function normalizeStation(station) {
  if (!station || typeof station !== "string") {
    return undefined;
  }

  const value = station.trim().toUpperCase().replace(/[\s-]+/g, "_");

  if (value === "CUNTO_SOOMAALI" || value === "CUNTO_SOMAALI") {
    return "CUNTO_SOOMAALI";
  }

  if (value === "FAST_FOOD") {
    return "FAST_FOOD";
  }

  if (value === "CABITAAN") {
    return "CABITAAN";
  }

  if (value === "BARISTA") {
    return "BARISTA";
  }

  return undefined;
}

function normalizeModifier(modifier) {
  if (!modifier?.id || !modifier?.name) {
    return null;
  }

  return {
    id: String(modifier.id),
    name: String(modifier.name),
    qty: Math.max(1, Number(modifier.qty) || 1),
    price: Number(modifier.price) || 0,
  };
}

function normalizeItem(item) {
  const station = normalizeStation(item?.station);

  if (!station || !item?.id || !item?.name) {
    return null;
  }

  const modifiers = Array.isArray(item?.modifiers)
    ? item.modifiers.map(normalizeModifier).filter(Boolean)
    : [];

  return {
    id: String(item.id),
    name: String(item.name),
    quantity: Math.max(1, Number(item.quantity) || 1),
    station,
    assignedUserId: item?.assignedUserId ? String(item.assignedUserId) : null,
    assignedUserName: item?.assignedUserName
      ? String(item.assignedUserName)
      : null,
    modifiers,
  };
}

function normalizeTicket(ticket) {
  if (!ticket || typeof ticket !== "object") {
    return null;
  }

  const orderId = ticket.orderId ?? ticket.id;
  const orderNumber = Number(ticket.orderNumber ?? ticket.receiptNo);
  const items = Array.isArray(ticket.items)
    ? ticket.items.map(normalizeItem).filter(Boolean)
    : [];

  if (!ticket.id || !orderId || !Number.isFinite(orderNumber) || items.length === 0) {
    return null;
  }

  return {
    id: String(ticket.id),
    orderId: String(orderId),
    orderNumber: Number(orderNumber),
    createdAt: String(ticket.createdAt || new Date().toISOString()),
    note: ticket.note ? String(ticket.note) : null,
    waiterId: ticket.waiterId ? String(ticket.waiterId) : null,
    waiterName: ticket.waiterName ? String(ticket.waiterName) : null,
    status:
      ticket.status === "in_progress" || ticket.status === "done"
        ? ticket.status
        : "new",
    items,
  };
}

function filterTicket(ticket, filter) {
  if (!ticket || ticket.status === "done") {
    return null;
  }

  const normalizedStation = normalizeStation(filter?.station);
  let items = Array.isArray(ticket.items) ? ticket.items : [];

  if (normalizedStation) {
    items = items.filter((item) => item.station === normalizedStation);
  }

  if (
    normalizedStation === "BARISTA" &&
    filter?.role === "BARISTA" &&
    filter?.userId
  ) {
    items = items.filter((item) => item.assignedUserId === filter.userId);
  }

  if (items.length === 0) {
    return null;
  }

  return {
    ...ticket,
    items,
  };
}

function resolveClientFilter(request) {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

  return {
    station: url.searchParams.get("station"),
    userId: url.searchParams.get("userId"),
    role: url.searchParams.get("role"),
  };
}

function send(client, message) {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }

  client.send(JSON.stringify(message));
}

function sendSnapshot(client) {
  const filter = clientFilters.get(client);
  const snapshot = Array.from(activeTickets.values())
    .map((ticket) => filterTicket(ticket, filter))
    .filter(Boolean);

  send(client, { type: "ORDER_SNAPSHOT", payload: snapshot });
}

function broadcastNewOrder(ticket) {
  for (const client of wss.clients) {
    const filter = clientFilters.get(client);
    const filteredTicket = filterTicket(ticket, filter);

    if (!filteredTicket) {
      continue;
    }

    send(client, { type: "NEW_ORDER", payload: filteredTicket });
  }
}

function broadcast(message) {
  const serialized = JSON.stringify(message);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, tickets: activeTickets.size }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Kitchen websocket server running");
});

const wss = new WebSocketServer({ server });

wss.on("error", (error) => {
  console.error("Kitchen WebSocket server error:", error.message);
});

wss.on("connection", (socket, request) => {
  clientFilters.set(socket, resolveClientFilter(request));
  sendSnapshot(socket);

  socket.on("message", (rawMessage) => {
    let message = null;

    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      return;
    }

    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "NEW_ORDER") {
      const ticket = normalizeTicket(message.payload);

      if (!ticket) {
        return;
      }

      activeTickets.set(ticket.id, ticket);
      broadcastNewOrder(ticket);
      return;
    }

    if (message.type === "ORDER_SNAPSHOT") {
      const tickets = Array.isArray(message.payload)
        ? message.payload.map(normalizeTicket).filter(Boolean)
        : [];

      activeTickets.clear();

      for (const ticket of tickets) {
        activeTickets.set(ticket.id, ticket);
      }

      for (const client of wss.clients) {
        sendSnapshot(client);
      }

      return;
    }

    if (message.type === "UPDATE_ORDER_STATUS") {
      const payload = message.payload;

      if (!payload || typeof payload !== "object" || !payload.id) {
        return;
      }

      const existing = activeTickets.get(String(payload.id));

      if (!existing) {
        return;
      }

      const status = payload.status;

      if (status === "done") {
        activeTickets.delete(existing.id);
      } else if (status === "new" || status === "in_progress") {
        activeTickets.set(existing.id, { ...existing, status });
      } else {
        return;
      }

      broadcast({
        type: "UPDATE_ORDER_STATUS",
        payload: { id: existing.id, status },
      });
    }
  });

  socket.on("close", () => {
    clientFilters.delete(socket);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error.message);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Kitchen websocket server running on ws://${HOST}:${PORT}`);
});
