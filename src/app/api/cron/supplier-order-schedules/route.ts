import { NextResponse } from "next/server";
import { processScheduledSupplierOrders } from "@/lib/supplier-orders/service";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await processScheduledSupplierOrders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Scheduled supplier ordering cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduled ordering failed." },
      { status: 500 },
    );
  }
}
