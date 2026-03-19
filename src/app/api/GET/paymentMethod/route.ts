import { NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";

export async function GET() {
  try {
    return NextResponse.json(Object.values(PaymentMethod));
  } catch (error) {
    console.error("GET /api/GET/paymentMethod error:", error);

    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 },
    );
  }
}
