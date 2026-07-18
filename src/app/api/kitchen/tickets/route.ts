import { NextRequest, NextResponse } from "next/server";
import { authorizeApiAny } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getKitchenTicketSnapshot } from "@/lib/kitchen/kitchen-tickets";
import { normalizeKitchenStation } from "@/lib/kitchen/kitchen-socket";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiAny([
    PERMISSIONS.KITCHEN_TICKET_VIEW,
    PERMISSIONS.ORDER_VIEW_ASSIGNED,
  ]);
  if (!authorization.ok) return authorization.response;

  const requestedStation = request.nextUrl.searchParams.get("station");

  if (requestedStation && !normalizeKitchenStation(requestedStation)) {
    return NextResponse.json(
      { error: "Invalid kitchen station." },
      { status: 400 },
    );
  }

  if (requestedStation && authorization.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can choose another kitchen station." },
      { status: 403 },
    );
  }

  const tickets = await getKitchenTicketSnapshot(
    authorization.user,
    requestedStation,
  );

  return NextResponse.json({ ok: true, tickets });
}
