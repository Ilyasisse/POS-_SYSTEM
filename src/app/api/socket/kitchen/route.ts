import { NextRequest, NextResponse } from "next/server";
import type { KitchenSocketMessage, KitchenTicket } from "@/lib/kitchen-socket";
import {
  filterKitchenTicketsByStation,
  normalizeKitchenTicket,
  normalizeKitchenStation,
  setKitchenTicketPickupStatus,
  setKitchenTicketStationStatus,
} from "@/lib/kitchen-socket";

const globalForKitchen = globalThis as unknown as {
  kitchenTickets?: KitchenTicket[];
};

if (!globalForKitchen.kitchenTickets) {
  globalForKitchen.kitchenTickets = [];
}

function resolveFilter(req: NextRequest) {
  return {
    station: req.nextUrl.searchParams.get("station"),
    userId: req.nextUrl.searchParams.get("userId"),
    role: req.nextUrl.searchParams.get("role"),
  };
}

function snapshotForRequest(req: NextRequest) {
  return filterKitchenTicketsByStation(
    globalForKitchen.kitchenTickets ?? [],
    resolveFilter(req),
  );
}

export async function GET(req: NextRequest) {
  const filter = resolveFilter(req);

  return NextResponse.json({
    ok: true,
    type: "ORDER_SNAPSHOT",
    station: filter.station ?? null,
    tickets: snapshotForRequest(req),
  });
}

export async function POST(req: NextRequest) {
  try {
    const message = (await req.json()) as KitchenSocketMessage;

    if (message.type === "NEW_ORDER") {
      const incoming = normalizeKitchenTicket(message.payload);

      if (!incoming) {
        return NextResponse.json(
          { ok: false, message: "Invalid kitchen ticket." },
          { status: 400 },
        );
      }

      globalForKitchen.kitchenTickets = [
        incoming,
        ...(globalForKitchen.kitchenTickets ?? []).filter(
          (ticket) => ticket.id !== incoming.id,
        ),
      ];

      return NextResponse.json({
        ok: true,
        type: "NEW_ORDER",
        ticket: incoming,
      });
    }

    if (message.type === "ORDER_SNAPSHOT") {
      const incomingTickets = Array.isArray(message.payload)
        ? message.payload
            .map(normalizeKitchenTicket)
            .filter((ticket): ticket is KitchenTicket => ticket !== null)
        : [];

      globalForKitchen.kitchenTickets = incomingTickets;

      return NextResponse.json({
        ok: true,
        type: "ORDER_SNAPSHOT",
        tickets: globalForKitchen.kitchenTickets,
      });
    }

    if (message.type === "UPDATE_ORDER_STATUS") {
      const { id, station, status } = message.payload;
      const normalizedStation = normalizeKitchenStation(station);

      if (!normalizedStation) {
        return NextResponse.json(
          { ok: false, message: "Invalid kitchen station." },
          { status: 400 },
        );
      }

      globalForKitchen.kitchenTickets = (globalForKitchen.kitchenTickets ?? [])
        .map((ticket) =>
          ticket.id === id
            ? setKitchenTicketStationStatus(ticket, normalizedStation, status)
            : ticket,
        );

      return NextResponse.json({
        ok: true,
        type: "UPDATE_ORDER_STATUS",
        payload: { id, station: normalizedStation, status },
      });
    }

    if (message.type === "UPDATE_PICKUP_STATUS") {
      const {
        id,
        pickupStatus,
        claimedByWaiterId,
        claimedByWaiterName,
      } = message.payload;

      globalForKitchen.kitchenTickets =
        pickupStatus === "delivered"
          ? (globalForKitchen.kitchenTickets ?? []).filter(
              (ticket) => ticket.id !== id,
            )
          : (globalForKitchen.kitchenTickets ?? []).map((ticket) =>
              ticket.id === id
                ? setKitchenTicketPickupStatus(
                    ticket,
                    pickupStatus,
                    claimedByWaiterId,
                    claimedByWaiterName,
                  )
                : ticket,
            );

      return NextResponse.json({
        ok: true,
        type: "UPDATE_PICKUP_STATUS",
        payload: {
          id,
          pickupStatus,
          claimedByWaiterId,
          claimedByWaiterName,
        },
      });
    }

    return NextResponse.json(
      { ok: false, message: "Unsupported message type." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Kitchen route error:", error);

    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 },
    );
  }
}
