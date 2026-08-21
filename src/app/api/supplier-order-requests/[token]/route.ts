import { NextResponse } from "next/server";
import {
  checkSupplierOrderRequestRateLimit,
  saveSupplierOrderRequest,
} from "@/lib/supplier-orders/requests";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!checkSupplierOrderRequestRateLimit(token)) {
    return NextResponse.json(
      { error: "Too many requests. Wait a minute and try again." },
      { status: 429 },
    );
  }
  try {
    const payload = await request.json();
    const result = await saveSupplierOrderRequest(token, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save this order response.",
      },
      { status: 400 },
    );
  }
}
