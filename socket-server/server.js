import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3001;

const channels = new Map();

function subscribe(ws, channel) {
  if (!channels.has(channel)) {
    channels.set(channel, new Set());
  }
  channels.get(channel).add(ws);
}

function unsubscribe(ws) {
  for (const [, clients] of channels) {
    clients.delete(ws);
  }
}

function broadcast(channel, message) {
  const clients = channels.get(channel);
  if (!clients) return;

  const payload = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Socket server running");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const station = url.searchParams.get("station");

  if (station) {
    subscribe(ws, `station-${station}`);
  }

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === "NEW_ORDER" && Array.isArray(message.stations)) {
        for (const stationName of message.stations) {
          broadcast(`station-${stationName}`, {
            type: "NEW_ORDER",
            payload: message.payload,
          });
        }
        return;
      }

      if (
        message.type === "UPDATE_ORDER_STATUS" &&
        Array.isArray(message.stations)
      ) {
        for (const stationName of message.stations) {
          broadcast(`station-${stationName}`, {
            type: "UPDATE_ORDER_STATUS",
            payload: message.payload,
          });
        }
      }
    } catch (error) {
      console.error("Invalid websocket message:", error);
    }
  });

  ws.on("close", () => {
    unsubscribe(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});