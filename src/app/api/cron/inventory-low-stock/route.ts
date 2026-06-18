import { NextResponse } from "next/server";
import { sendDailyInventorySupplyDigest } from "@/lib/inventory/inventory";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Cron secret is not configured." },
      { status: 500 },
    );
  }

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await sendDailyInventorySupplyDigest();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Daily inventory alert cron failed:", error);

    return NextResponse.json(
      { error: "Daily inventory alert failed." },
      { status: 500 },
    );
  }
}
