/* eslint-disable @typescript-eslint/no-require-imports */
const { WebSocketServer, WebSocket } = require("ws");

const port = Number(process.env.KITCHEN_WS_PORT || 8080);
const host = process.env.KITCHEN_WS_HOST || "0.0.0.0";
const wss = new WebSocketServer({ port, host });

const activeTickets = new Map();
const salesByDay = new Map();

function safeParse(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

function send(client, message) {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }
  client.send(JSON.stringify(message));
}

function broadcast(message) {
  const serialized = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function normalizeTicket(ticket) {
  if (!ticket || typeof ticket !== "object") {
    return null;
  }
  if (!ticket.id || !ticket.receiptNo || !Array.isArray(ticket.items)) {
    return null;
  }
  return {
    id: String(ticket.id),
    receiptNo: Number(ticket.receiptNo),
    createdAt: String(ticket.createdAt || new Date().toISOString()),
    note: ticket.note ? String(ticket.note) : null,
    status: ticket.status === "in_progress" ? "in_progress" : "new",
    items: ticket.items
      .map((item) => ({
        id: String(item.id),
        name: String(item.name),
        quantity: Math.max(1, Number(item.quantity) || 1),
      }))
      .filter((item) => item.name.length > 0),
  };
}

function toDayKey(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function normalizeSale(sale) {
  if (!sale || typeof sale !== "object") {
    return null;
  }
  if (!sale.id || !sale.receiptNo || !sale.waiterName) {
    return null;
  }
  const normalized = {
    id: String(sale.id),
    receiptNo: Number(sale.receiptNo),
    waiterName: String(sale.waiterName),
    total: Number(sale.total) || 0,
    createdAt: String(sale.createdAt || new Date().toISOString()),
  };
  if (!Number.isFinite(normalized.total) || normalized.total < 0) {
    normalized.total = 0;
  }
  return normalized;
}

wss.on("error", (error) => {
  console.error("Kitchen WebSocket server error:", error.message);
});

wss.on("connection", (socket) => {
  const snapshot = Array.from(activeTickets.values());
  send(socket, { type: "ORDER_SNAPSHOT", payload: snapshot });
  const day = toDayKey(new Date());
  send(socket, {
    type: "SALES_SNAPSHOT",
    payload: {
      day,
      sales: salesByDay.get(day) || [],
    },
  });

  socket.on("message", (rawMessage) => {
    const message = safeParse(rawMessage);
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "NEW_ORDER") {
      const ticket = normalizeTicket(message.payload);
      if (!ticket) {
        return;
      }

      activeTickets.set(ticket.id, ticket);
      broadcast({ type: "NEW_ORDER", payload: ticket });
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
      return;
    }

    if (message.type === "NEW_SALE") {
      const sale = normalizeSale(message.payload);
      if (!sale) {
        return;
      }

      const day = toDayKey(sale.createdAt);
      const daySales = salesByDay.get(day) || [];
      daySales.push(sale);
      salesByDay.set(day, daySales);
      broadcast({
        type: "NEW_SALE",
        payload: sale,
      });
    }
  });
});

console.log(`Kitchen WebSocket server running on ws://${host}:${port}`);
