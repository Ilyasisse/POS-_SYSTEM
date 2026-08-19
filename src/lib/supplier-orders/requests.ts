import { prisma } from "@/lib/prisma";
import { hashRecipientToken, parseEmployeeResponse } from "./scheduling";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkSupplierOrderRequestRateLimit(token: string, now = Date.now()) {
  if (attempts.size > 5000) {
    for (const [key, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(key);
    }
  }
  const key = hashRecipientToken(token);
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 20) return false;
  current.count += 1;
  return true;
}

export async function getSupplierOrderRequest(token: string) {
  const recipient = await prisma.supplierOrderRunRecipient.findUnique({
    where: { tokenHash: hashRecipientToken(token) },
    include: {
      responseItems: true,
      run: {
        include: {
          schedule: { select: { deletedAt: true } },
          supplier: {
            select: {
              catalogItems: {
                where: { isActive: true },
                select: {
                  id: true,
                  unit: true,
                  product: { select: { name: true, isActive: true } },
                  inventorySupply: { select: { name: true, isActive: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!recipient) return null;
  const editable =
    recipient.run.schedule.deletedAt === null &&
    recipient.run.supplierSendAt.getTime() > Date.now() &&
    ["SCHEDULED", "COLLECTING"].includes(recipient.run.status);
  const items = recipient.run.supplier.catalogItems
    .flatMap((item) => {
      const name = item.product?.isActive
        ? item.product.name
        : item.inventorySupply?.isActive
          ? item.inventorySupply.name
          : null;
      return name ? [{ id: item.id, name, unit: item.unit }] : [];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    recipientId: recipient.id,
    employeeName: recipient.employeeName,
    supplierName: recipient.run.supplierName,
    deadline: recipient.run.supplierSendAt,
    timeZone: recipient.run.timeZone,
    status: recipient.status,
    editable,
    items,
    selected: Object.fromEntries(
      recipient.responseItems.map((item) => [
        item.supplierCatalogItemId,
        item.quantity.toString(),
      ]),
    ),
  };
}

export async function saveSupplierOrderRequest(token: string, raw: unknown) {
  const input = parseEmployeeResponse(raw);
  const tokenHash = hashRecipientToken(token);
  return prisma.$transaction(async (tx) => {
    const recipient = await tx.supplierOrderRunRecipient.findUnique({
      where: { tokenHash },
      include: {
        run: {
          include: { schedule: { select: { deletedAt: true } } },
        },
      },
    });
    if (!recipient) throw new Error("This order link is invalid or expired.");
    if (
      recipient.run.schedule.deletedAt !== null ||
      recipient.run.supplierSendAt.getTime() <= Date.now() ||
      !["SCHEDULED", "COLLECTING"].includes(recipient.run.status)
    ) {
      throw new Error("This order has already closed and can no longer be changed.");
    }
    if (!input.noOrder) {
      const validCount = await tx.supplierCatalogItem.count({
        where: {
          id: { in: input.items.map((item) => item.catalogItemId) },
          supplierId: recipient.run.supplierId,
          isActive: true,
          OR: [
            { product: { isActive: true } },
            { inventorySupply: { isActive: true } },
          ],
        },
      });
      if (validCount !== input.items.length) {
        throw new Error("One or more selected items are no longer available.");
      }
    }
    await tx.supplierOrderResponseItem.deleteMany({
      where: { recipientId: recipient.id },
    });
    if (!input.noOrder) {
      await tx.supplierOrderResponseItem.createMany({
        data: input.items.map((item) => ({
          recipientId: recipient.id,
          supplierCatalogItemId: item.catalogItemId,
          quantity: item.quantity,
        })),
      });
    }
    await tx.supplierOrderRunRecipient.update({
      where: { id: recipient.id },
      data: {
        status: input.noOrder ? "NO_ORDER" : "RESPONDED",
        respondedAt: new Date(),
      },
    });
    return { status: input.noOrder ? "NO_ORDER" : "RESPONDED" } as const;
  });
}
