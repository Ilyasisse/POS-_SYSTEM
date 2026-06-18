import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getWaiterBusinessDayShiftSummary } from "@/lib/waiter/waiter-shifts";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Not authenticated" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: authUser.id,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Staff account not found" },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

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
