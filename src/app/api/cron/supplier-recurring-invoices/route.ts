import { NextResponse } from "next/server";
import { generateDueSupplierInvoiceDrafts } from "@/lib/suppliers/invoice-recurrence-service";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!authorization || !cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await generateDueSupplierInvoiceDrafts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Recurring supplier invoice cron failed:", error);
    return NextResponse.json(
      { error: "Recurring supplier invoice generation failed." },
      { status: 500 },
    );
  }
}
