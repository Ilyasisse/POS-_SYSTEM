import { NextRequest, NextResponse } from "next/server";
import { KitchenQualityEventType } from "@prisma/client";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { canAccessStation, PERMISSIONS } from "@/lib/auth/permissions";
import { normalizeKitchenStation } from "@/lib/kitchen/kitchen-socket";
import { recordKitchenQualityEvent } from "@/lib/kitchen/kitchen-operations";
import { getPostHogClient } from "@/lib/posthog-server";

const QUALITY_TYPES = new Set<KitchenQualityEventType>([
  "LATE",
  "REMAKE",
  "WRONG_ORDER",
  "WAITER_MISTAKE",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const authorization = await authorizeApi(PERMISSIONS.KITCHEN_QUALITY_RECORD);
  if (!authorization.ok) return authorization.response;
  try {
    const body = (await request.json()) as {
      type?: unknown;
      reason?: unknown;
      orderItemId?: unknown;
      station?: unknown;
    };
    const type = typeof body.type === "string" ? body.type.toUpperCase() as KitchenQualityEventType : null;
    const station = normalizeKitchenStation(typeof body.station === "string" ? body.station : null);
    if (!type || !QUALITY_TYPES.has(type) || typeof body.reason !== "string") {
      return NextResponse.json({ error: "A valid event type and reason are required." }, { status: 400 });
    }
    if (station && !canAccessStation(authorization.user, [station])) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const { orderId } = await context.params;
    const event = await recordKitchenQualityEvent({
      orderId,
      orderItemId: typeof body.orderItemId === "string" ? body.orderItemId : null,
      station: station ?? null,
      type,
      reason: body.reason,
      actorUserId: authorization.user.id,
    });

    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: authorization.user.id,
        event: "kitchen_quality_event_recorded",
        properties: {
          order_id: orderId,
          order_item_id:
            typeof body.orderItemId === "string" ? body.orderItemId : null,
          station,
          quality_event_type: type,
          staff_role: authorization.user.role,
        },
      });
      await posthog.flush();
    }

    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to record quality event." },
      { status: 400 },
    );
  }
}
