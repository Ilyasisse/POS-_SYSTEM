import { SalesAdjustmentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { authorizeApiAny } from "@/lib/auth/api-authorization";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  createSalesAdjustment,
  requiredAdjustmentPermission,
  SalesAdjustmentError,
} from "@/lib/sales/adjustments";

type RouteContext = { params: Promise<{ orderId: string }> };
type AdjustmentBody = {
  orderItemId?: string | null;
  type?: string;
  amount?: string;
  quantity?: string | null;
  reason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const authorization = await authorizeApiAny([
    PERMISSIONS.ADJUSTMENT_OPERATIONAL_APPROVE,
    PERMISSIONS.ADJUSTMENT_FINANCIAL_APPROVE,
  ]);
  if (!authorization.ok) return authorization.response;

  try {
    const { orderId } = await context.params;
    const body = (await request.json()) as AdjustmentBody;
    if (
      !body.type ||
      !Object.values(SalesAdjustmentType).includes(
        body.type as SalesAdjustmentType,
      )
    ) {
      return NextResponse.json(
        { error: "Adjustment type is invalid." },
        { status: 400 },
      );
    }

    const type = body.type as SalesAdjustmentType;
    if (
      !hasPermission(
        authorization.user,
        requiredAdjustmentPermission(type),
      )
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const adjustment = await prisma.$transaction((tx) =>
      createSalesAdjustment(tx, {
        orderId,
        orderItemId: body.orderItemId,
        type,
        amount: String(body.amount ?? ""),
        quantity: body.quantity,
        reason: String(body.reason ?? ""),
        actorUserId: authorization.user.id,
        approvedByUserId: authorization.user.id,
      }),
    );

    return NextResponse.json(
      {
        adjustment: {
          id: adjustment.id,
          orderId: adjustment.orderId,
          type: adjustment.type,
          amount: adjustment.amount.toFixed(2),
          createdAt: adjustment.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SalesAdjustmentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Sales adjustment error:", error);
    return NextResponse.json(
      { error: "Failed to record the sales adjustment." },
      { status: 500 },
    );
  }
}
