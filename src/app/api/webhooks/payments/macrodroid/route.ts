import { NextResponse } from "next/server";
import {
  isExpectedMacrodroidSender,
  isMacrodroidAuthorized,
} from "@/lib/payments/macrodroid-auth";
import { ingestMobileMoneyReceipt } from "@/lib/payments/mobile-money-receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isMacrodroidAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    let sender = request.headers.get("x-sms-sender")?.trim() ?? "";
    let rawMessage = "";
    let receivedAt: Date | undefined;

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      sender ||= String(body.sender ?? "").trim();
      rawMessage = String(body.message ?? "");
      if (body.receivedAt) {
        const candidate = new Date(String(body.receivedAt));
        if (!Number.isNaN(candidate.getTime())) receivedAt = candidate;
      }
    } else {
      rawMessage = await request.text();
    }

    if (!isExpectedMacrodroidSender(sender)) {
      return NextResponse.json(
        { error: "The SMS sender is not allowed." },
        { status: 400 },
      );
    }
    if (!rawMessage.trim() || rawMessage.length > 4096) {
      return NextResponse.json(
        { error: "The SMS body must contain between 1 and 4096 characters." },
        { status: 400 },
      );
    }

    const result = await ingestMobileMoneyReceipt({
      sender,
      rawMessage,
      receivedAt,
    });
    const status = result.duplicate
      ? 200
      : result.receipt.status === "NEEDS_REVIEW"
        ? 202
        : 201;

    return NextResponse.json(
      {
        ok: true,
        duplicate: result.duplicate,
        receiptId: result.receipt.id,
        status: result.receipt.status,
      },
      { status },
    );
  } catch (error) {
    console.error("MacroDroid payment receipt error:", error);
    return NextResponse.json(
      { error: "Payment receipt could not be stored." },
      { status: 500 },
    );
  }
}
