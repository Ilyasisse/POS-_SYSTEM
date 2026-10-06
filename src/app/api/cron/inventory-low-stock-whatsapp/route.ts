import { NextResponse } from "next/server";
import { sendInventoryWhatsAppDigest } from "@/lib/inventory/send-whatsapp-digest";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Cron secret is not configured." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return NextResponse.json(await sendInventoryWhatsAppDigest());
  } catch (error) {
    console.error("Inventory WhatsApp digest failed:", error);
    return NextResponse.json(
      { error: "Inventory WhatsApp digest failed." },
      { status: 500 },
    );
  }
}
