import assert from "node:assert/strict";
import { after, test } from "node:test";
import { getDailyCash } from "../../src/lib/daily-cash/service";
import {
  initializeWaiterBalance,
  saveWaiterSettlement,
} from "../../src/lib/waiter/waiter-balance-ledger";
import { prisma } from "../../src/lib/prisma";
import { client, db, json, product, user } from "../workflow/fixtures";

after(async () => {
  await Promise.all([db.$disconnect(), prisma.$disconnect()]);
});

test("a corrected waiter settlement rolls forward and Daily Cash uses the prior day's hand-in", async () => {
  const [waiter, admin] = await Promise.all([user("WAITER"), user("ADMIN")]);
  const now = new Date("2026-10-06T10:00:00Z");
  await initializeWaiterBalance({
    waiterId: waiter.id,
    createdByUserId: admin.id,
    openingBalance: 0,
    now,
  });
  const save = (businessDateKey: string, endDayAmount: number) =>
    saveWaiterSettlement({
      waiterId: waiter.id,
      businessDateKey,
      reportedSales: 30,
      endDayAmount,
      settledByUserId: admin.id,
      now,
    });
  await save("2026-10-03", 24);
  await save("2026-10-04", 28);
  const secondDay = () =>
    db.shift.findUniqueOrThrow({
      where: { userId_businessDate: { userId: waiter.id, businessDate: new Date("2026-10-04") } },
    });
  assert.equal(Number((await secondDay()).openingAmount), -6);
  await save("2026-10-03", 26);
  assert.equal(Number((await secondDay()).openingAmount), -4);
  await db.dailySalaryRate.create({
    data: { effectiveBusinessDate: new Date("2026-10-05"), amount: 5, createdByUserId: admin.id },
  });
  const daily = await getDailyCash("2026-10-05", now);
  assert.equal(daily?.waiterBalanceDateKey, "2026-10-04");
  assert.equal(daily?.endDayCash, 28);
});

test("daily sales, CSV and audit agree across the Nairobi business-day boundary", async () => {
  const [item, admin, cashier] = await Promise.all([product(), user("ADMIN"), user("CASHIER")]);
  const api = await client(admin);
  const seed = (closedAt: string, status: "PAID" | "OPEN" = "PAID") =>
    db.order.create({
      data: {
        type: "TAKEOUT",
        status,
        createdAt: new Date(closedAt),
        closedAt: status === "PAID" ? new Date(closedAt) : null,
        total: 20,
        cashierId: cashier.id,
        orderItems: {
          create: {
            productId: item.id,
            productName: item.name,
            qty: 1,
            unitPrice: 20,
            lineTotal: 20,
          },
        },
        ...(status === "PAID"
          ? {
              payments: {
                create: {
                  cashierId: cashier.id,
                  cashierName: cashier.fullName,
                  method: "OTHER",
                  amountPaid: 20,
                  createdAt: new Date(closedAt),
                },
              },
            }
          : {}),
      },
    });
  const [included, discounted] = await Promise.all([
    seed("2026-10-08T04:00:00Z"),
    seed("2026-10-08T04:05:00Z", "OPEN"),
    seed("2026-10-08T03:59:59Z"),
    seed("2026-10-09T02:00:00Z"),
    seed("2026-10-08T04:01:00Z", "OPEN"),
  ]);
  await json(
    await api(`/api/orders/${included.id}/adjustments`, {
      body: { type: "REFUND", amount: "3.00", reason: "Workflow test refund" },
    }),
    201,
  );
  await json(
    await api(`/api/orders/${discounted.id}/adjustments`, {
      body: { type: "DISCOUNT", amount: "2.00", reason: "Workflow test discount" },
    }),
    201,
  );
  // The payment route supplies the close time. Keep this report fixture on its
  // fixed business date after recording the discount and actual payment.
  const cashierApi = await client(cashier);
  await json(
    await cashierApi("/api/orders/pay", {
      body: { orderId: discounted.id, paymentMethod: "OTHER" },
    }),
  );
  await db.order.update({ where: { id: discounted.id }, data: { closedAt: discounted.createdAt } });
  const filters = `businessDate=2026-10-08&cashierId=${cashier.id}`;
  const report = await json<{ summary: { grossSales: string; netSales: string } }>(
    await api(`/api/admin/reports/sales?${filters}`),
  );
  assert.equal(report.summary.grossSales, "40.00");
  assert.equal(report.summary.netSales, "35.00");
  const exportPath = `/api/admin/reports/export?report=sales&format=csv&${filters}`;
  const csv = await api(exportPath, { method: "POST" });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /35\.00/);
  const auditFilter = { actorUserId: admin.id, report: "sales", format: "csv" };
  assert.equal(await db.reportExportAudit.count({ where: auditFilter }), 1);
  const viewer = await client(await user("WAITER"));
  assert.equal((await viewer(exportPath, { method: "POST" })).status, 403);
  assert.equal(await db.reportExportAudit.count({ where: auditFilter }), 1);
});
