import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getWaiterBusinessDayShiftSummary } from "@/lib/waiter/waiter-shifts";

export async function GET() {
  try {
    const authorization = await authorizeApi(
      PERMISSIONS.ORDER_VIEW_ASSIGNED,
    );
    if (!authorization.ok) return authorization.response;
    const user = authorization.user;

    const shiftSummary = await getWaiterBusinessDayShiftSummary(user.id);
    const canPlaceOrders =
      user.role !== "WAITER" || shiftSummary.status === "open";
    const orderingNotice =
      user.role !== "WAITER"
        ? null
        : shiftSummary.status === "not_opened"
          ? "Go to the cashier and enter your opening balance first before ordering."
          : shiftSummary.status === "closed"
            ? "Your balance is already closed for today. Please go to the cashier."
            : null;

    return NextResponse.json(
      {
        canPlaceOrders,
        orderingNotice,
        openingBalance: shiftSummary.openingAmount,
        shiftStatus: shiftSummary.status,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/waiter/shift-status error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
