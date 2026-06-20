import { NextRequest, NextResponse } from "next/server";
import type { KitchenSocketMessage, KitchenTicket } from "@/lib/kitchen/kitchen-socket";
import {
  filterKitchenTicketsByStation,
  normalizeKitchenTicket,
  normalizeKitchenStation,
  setKitchenTicketPickupStatus,
  setKitchenTicketStationStatus,
} from "@/lib/kitchen/kitchen-socket";
import { authorizeApiAny } from "@/lib/auth/api-authorization";
import {
  canAccessStation,
  getEffectiveStation,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

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

export async function GET(req: NextRequest) {
  const authorization = await authorizeApiAny([
    PERMISSIONS.KITCHEN_TICKET_VIEW,
    PERMISSIONS.ORDER_VIEW_ASSIGNED,
  ]);
  if (!authorization.ok) return authorization.response;

  const requestedFilter = resolveFilter(req);
  const user = authorization.user;
  const filter = hasPermission(user, PERMISSIONS.ORDER_VIEW_ALL)
    ? requestedFilter
    : {
        station: getEffectiveStation(user),
        userId: user.id,
        role: user.role,
      };

  return NextResponse.json({
    ok: true,
    type: "ORDER_SNAPSHOT",
    station: filter.station ?? null,
    tickets: filterKitchenTicketsByStation(
      globalForKitchen.kitchenTickets ?? [],
      filter,
    ),
  });
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeApiAny([
      PERMISSIONS.KITCHEN_TICKET_UPDATE,
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_VIEW_ASSIGNED,
    ]);
    if (!authorization.ok) return authorization.response;

    const message = (await req.json()) as KitchenSocketMessage;
    const user = authorization.user;

    if (message.type === "NEW_ORDER") {
      if (!hasPermission(user, PERMISSIONS.ORDER_CREATE)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
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
      if (!hasPermission(user, PERMISSIONS.ORDER_CREATE)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
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

      if (
        !hasPermission(user, PERMISSIONS.KITCHEN_TICKET_UPDATE) ||
        !canAccessStation(user, [normalizedStation])
      ) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
      if (!hasPermission(user, PERMISSIONS.ORDER_VIEW_ASSIGNED)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
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
