import { NextResponse } from "next/server";
import {
  isExpectedMacrodroidSender,
  isMacrodroidAuthorized,
} from "@/lib/payments/macrodroid-auth";
import { recordMacrodroidHeartbeat } from "@/lib/payments/mobile-money-receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isMacrodroidAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const sender = request.headers.get("x-sms-sender")?.trim() ?? "";
  if (!isExpectedMacrodroidSender(sender)) {
    return NextResponse.json(
      { error: "The SMS sender is not allowed." },
      { status: 400 },
    );
  }
  await recordMacrodroidHeartbeat(sender);
  return NextResponse.json({ ok: true });
}
