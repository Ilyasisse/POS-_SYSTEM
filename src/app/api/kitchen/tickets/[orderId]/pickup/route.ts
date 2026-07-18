import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  KitchenTicketMutationError,
  updateKitchenTicketPickup,
} from "@/lib/kitchen/kitchen-tickets";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const authorization = await authorizeApi(PERMISSIONS.ORDER_VIEW_ASSIGNED);
  if (!authorization.ok) return authorization.response;

  try {
    const body = (await request.json()) as { pickupStatus?: unknown };
    const pickupStatus = body.pickupStatus;

    if (pickupStatus !== "claimed" && pickupStatus !== "delivered") {
      return NextResponse.json(
        { error: "A valid pickup status is required." },
        { status: 400 },
      );
    }

    const { orderId } = await context.params;
    await updateKitchenTicketPickup({
      orderId,
      pickupStatus,
      viewer: authorization.user,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof KitchenTicketMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Kitchen pickup update failed:", error);
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
