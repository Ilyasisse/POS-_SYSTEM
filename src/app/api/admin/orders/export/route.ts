import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { toOrderHistoryCsv } from "@/lib/admin/order-export-csv";

export const dynamic = "force-dynamic";
const EXPORT_LIMIT = 10_000;

export async function POST(request: Request) {
  const authorization = await authorizeApi(PERMISSIONS.REPORT_EXPORT);
  if (!authorization.ok) return authorization.response;
  if (!hasPermission(authorization.user, PERMISSIONS.ORDER_VIEW_ALL)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const form = await request.formData();
  const q =
    typeof form.get("q") === "string" ? String(form.get("q")).trim() : "";
  const status = form.get("status");
  const date = form.get("date");
  if (
    (status !== "all" &&
      status !== "OPEN" &&
      status !== "PAID" &&
      status !== "CANCELLED") ||
    (date !== "today" && date !== "all")
  ) {
    return NextResponse.json(
      { error: "Invalid order export filters." },
      { status: 400 },
    );
  }

  const digits = q.replace(/^#/, "");
  const orderNumber = q ? Number(digits) : null;
  if (
    q &&
    (!/^[1-9]\d*$/.test(digits) ||
      !Number.isSafeInteger(orderNumber) ||
      orderNumber! > 2_147_483_647)
  ) {
    return NextResponse.json(
      { error: "Enter a valid order number." },
      { status: 400 },
    );
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const where: Prisma.OrderWhereInput = {
    ...(status !== "all"
      ? { status: status as "OPEN" | "PAID" | "CANCELLED" }
      : {}),
    ...(date === "today" ? { createdAt: { gte: startOfToday } } : {}),
    ...(orderNumber !== null ? { orderNumber } : {}),
  };
  const matchingCount = await prisma.order.count({ where });
  if (matchingCount > EXPORT_LIMIT) {
    return NextResponse.json(
      {
        error: `More than ${EXPORT_LIMIT} orders match. Narrow the date or status filter before exporting.`,
      },
      { status: 413 },
    );
  }

  const orders = await prisma.order.findMany({
    where,
    take: EXPORT_LIMIT + 1,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      orderNumber: true,
      createdAt: true,
      status: true,
      type: true,
      total: true,
      table: { select: { name: true } },
      cashier: { select: { fullName: true } },
      waiter: { select: { fullName: true } },
      _count: { select: { orderItems: true } },
    },
  });
  if (orders.length > EXPORT_LIMIT) {
    return NextResponse.json(
      {
        error: `More than ${EXPORT_LIMIT} orders match. Narrow the filters before exporting.`,
      },
      { status: 413 },
    );
  }
  const csv = toOrderHistoryCsv(
    orders.map((order) => ({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      type: order.type,
      total: order.total.toString(),
      tableName: order.table?.name ?? null,
      cashierName: order.cashier?.fullName ?? null,
      waiterName: order.waiter?.fullName ?? null,
      itemCount: order._count.orderItems,
    })),
  );

  await prisma.reportExportAudit.create({
    data: {
      actorUserId: authorization.user.id,
      report: "order-history",
      format: "csv",
      filters: { q, status, date, count: orders.length },
    },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="order-history.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
