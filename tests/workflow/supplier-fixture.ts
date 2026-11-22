import { randomUUID } from "node:crypto";
import { hashRecipientToken } from "../../src/lib/supplier-orders/scheduling";
import { db, product, unique, user } from "./fixtures";

export async function supplierCatalog() {
  const [item, admin, supplier] = await Promise.all([
    product(),
    user("ADMIN"),
    db.supplier.create({
      data: { name: unique("Test supplier"), slug: `supplier-${randomUUID()}` },
    }),
  ]);
  const catalog = await db.supplierCatalogItem.create({
    data: { supplierId: supplier.id, productId: item.id, unit: "piece", unitPrice: 4 },
  });
  return { item, admin, supplier, catalog };
}

export async function supplierRequest() {
  const [{ item, admin, supplier, catalog }, employee] = await Promise.all([
    supplierCatalog(),
    user("CASHIER"),
  ]);
  const token = randomUUID();
  const inviteAt = new Date(Date.now() - 60_000);
  const supplierSendAt = new Date(Date.now() + 600_000);
  const schedule = await db.supplierOrderSchedule.create({
    data: {
      name: unique("Test schedule"),
      supplierId: supplier.id,
      createdByUserId: admin.id,
      firstInviteAt: inviteAt,
      firstSupplierSendAt: supplierSendAt,
      reminderIntervalMinutes: 5,
    },
  });
  const run = await db.supplierOrderRun.create({
    data: {
      scheduleId: schedule.id,
      sequence: 1,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierPhone: "+252900000001",
      timeZone: "Africa/Nairobi",
      inviteAt,
      supplierSendAt,
      reminderIntervalMinutes: 5,
      deliveryLeadDays: 1,
      status: "COLLECTING",
      recipients: {
        create: {
          userId: employee.id,
          employeeName: employee.fullName,
          phone: "+252900000002",
          tokenHash: hashRecipientToken(token),
        },
      },
    },
    include: { recipients: true },
  });
  return { token, item, admin, supplier, catalog, schedule, run, recipient: run.recipients[0] };
}
