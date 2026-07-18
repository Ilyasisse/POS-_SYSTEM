import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/api-authorization";
import {
  canAccessStation,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  KitchenTicketMutationError,
  updateKitchenTicketStation,
} from "@/lib/kitchen/kitchen-tickets";
import { normalizeKitchenStation } from "@/lib/kitchen/kitchen-socket";

const KITCHEN_STATUSES = new Set(["new", "in_progress", "done"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const authorization = await authorizeApi(PERMISSIONS.KITCHEN_TICKET_UPDATE);
  if (!authorization.ok) return authorization.response;

  try {
    const body = (await request.json()) as { station?: unknown; status?: unknown };
    const station = normalizeKitchenStation(
      typeof body.station === "string" ? body.station : null,
    );
    const status = typeof body.status === "string" ? body.status : null;

    if (!station || !status || !KITCHEN_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "A valid kitchen station and status are required." },
        { status: 400 },
      );
    }

    if (!canAccessStation(authorization.user, [station])) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { orderId } = await context.params;
    await updateKitchenTicketStation({
      orderId,
      station,
      status: status as "new" | "in_progress" | "done",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof KitchenTicketMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Kitchen station update failed:", error);
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
