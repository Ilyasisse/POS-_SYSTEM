import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { database } from "@/lib/database";
import { requirePlatformAdmin } from "@/lib/cafeteria/platform-admin";
import { normalizeHostname } from "@/lib/cafeteria/hostname";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const [cafeterias, staff] = await Promise.all([
      database.cafeteria.findMany({ include: { domains: true }, orderBy: { createdAt: "asc" } }),
      database.staff.findMany({ select: { id: true, fullName: true, email: true, role: true, station: true, cafeteriaId: true, isActive: true, isPlatformAdmin: true }, orderBy: { fullName: "asc" } }),
    ]);
    return NextResponse.json({ cafeterias, staff });
  } catch {
    return NextResponse.json({ error: "Platform administrator access is required." }, { status: 403 });
  }
}

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,49}$/), name: z.string().trim().min(2).max(100) }),
  z.object({ action: z.literal("status"), id: z.string().min(1), isActive: z.boolean() }),
  z.object({ action: z.literal("domain"), cafeteriaId: z.string().min(1), hostname: z.string().min(1) }),
  z.object({ action: z.literal("removeDomain"), hostname: z.string().min(1) }),
  z.object({ action: z.literal("staffStatus"), id: z.string().min(1), isActive: z.boolean() }),
  z.object({ action: z.literal("staffRole"), id: z.string().min(1), role: z.enum(["ADMIN", "MANAGER", "CASHIER", "WAITER", "COOK", "BARISTA", "Cabitaan"]), station: z.enum(["CUNTO_SOOMAALI", "FAST_FOOD", "CABITAAN", "BARISTA"]).nullable() }),
  z.object({ action: z.literal("staff"), cafeteriaId: z.string().min(1), email: z.email(), fullName: z.string().trim().min(2).max(100), password: z.string().min(12).max(128), role: z.enum(["ADMIN", "MANAGER", "CASHIER", "WAITER", "COOK", "BARISTA", "Cabitaan"]), station: z.enum(["CUNTO_SOOMAALI", "FAST_FOOD", "CABITAAN", "BARISTA"]).nullable() }),
]);

export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Platform administrator access is required." }, { status: 403 });
  }
  // Cookie-authenticated management must originate on this same domain.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const parsed = command.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form fields." }, { status: 400 });
  const input = parsed.data;
  try {
    if (input.action === "create") {
      await database.cafeteria.create({ data: { id: input.id, name: input.name } });
    } else if (input.action === "status") {
      if (input.id === "mashallah") throw new Error("Mashallah must remain active.");
      await database.cafeteria.update({ where: { id: input.id }, data: { isActive: input.isActive } });
    } else if (input.action === "domain") {
      const cafe = await database.cafeteria.findUnique({ where: { id: input.cafeteriaId } });
      if (!cafe?.isActive) throw new Error("Select an active cafeteria.");
      const hostname = normalizeHostname(input.hostname);
      if (process.env.MASHALLAH_DOMAIN && hostname === normalizeHostname(process.env.MASHALLAH_DOMAIN) && input.cafeteriaId !== "mashallah") throw new Error("The Mashallah domain cannot be reassigned.");
      await database.cafeteriaDomain.create({ data: { hostname, cafeteriaId: input.cafeteriaId } });
    } else if (input.action === "removeDomain") {
      const hostname = normalizeHostname(input.hostname);
      const domain = await database.cafeteriaDomain.findUnique({ where: { hostname } });
      if (domain?.cafeteriaId === "mashallah") throw new Error("Keep the Mashallah management domain.");
      await database.cafeteriaDomain.delete({ where: { hostname } });
    } else if (input.action === "staffStatus" || input.action === "staffRole") {
      const staff = await database.staff.findUnique({ where: { id: input.id } });
      if (!staff || staff.isPlatformAdmin) throw new Error("Platform administrator accounts are protected.");
      await database.staff.update({ where: { id: input.id }, data: input.action === "staffStatus" ? { isActive: input.isActive } : { role: input.role, station: input.station } });
    } else {
      const cafe = await database.cafeteria.findUnique({ where: { id: input.cafeteriaId } });
      if (!cafe?.isActive) throw new Error("Select an active cafeteria.");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Staff provisioning requires the server Supabase service key.");
      const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await auth.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true });
      if (error || !data.user) throw new Error(error?.message ?? "Unable to create staff account.");
      try {
        await database.staff.create({ data: { id: data.user.id, email: input.email, fullName: input.fullName, role: input.role, station: input.station, cafeteriaId: input.cafeteriaId } });
      } catch (error) {
        await auth.auth.admin.deleteUser(data.user.id);
        throw error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    return NextResponse.json({ error: code === "P2002" ? "This cafeteria, domain, or account already exists." : error instanceof Error && !code ? error.message : "Unable to save this change." }, { status: 400 });
  }
}
