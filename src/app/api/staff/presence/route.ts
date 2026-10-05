import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { StaffAvailability } from "@prisma/client";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isActive || user.role !== "CASHIER")
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const staff = await prisma.staff.findUnique({
    where: { id: user.id },
    select: { availability: true },
  });
  return NextResponse.json(
    { availability: staff?.availability },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user?.isActive || user.role !== "CASHIER")
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    availability?: unknown;
  } | null;
  if (
    !body ||
    (body.availability !== undefined &&
      !Object.values(StaffAvailability).includes(
        body.availability as StaffAvailability,
      ))
  ) {
    return NextResponse.json(
      { error: "Select a valid status." },
      { status: 400 },
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Staff" WHERE "id" = ${user.id} FOR UPDATE`;
    const staff = await tx.staff.findUniqueOrThrow({ where: { id: user.id } });
    const next = (body.availability ?? staff.availability) as StaffAvailability;
    await tx.staff.update({
      where: { id: user.id },
      data: { availability: next, lastSeenAt: new Date() },
    });
    if (next !== staff.availability)
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "staff.availability_changed",
          entityType: "Staff",
          entityId: user.id,
          previousValue: { availability: staff.availability },
          newValue: { availability: next },
        },
      });
  });
  return NextResponse.json({ ok: true });
}
