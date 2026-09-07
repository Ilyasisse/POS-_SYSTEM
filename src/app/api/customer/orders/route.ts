import { NextResponse } from "next/server";
import { Prisma, type Station } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createKitchenTicketState } from "@/lib/kitchen/kitchen-tickets";
import type { SelectedModifierLine } from "@/lib/types";
import {
  deductProductInventoryForSale,
  sendInventoryAlerts,
} from "@/lib/inventory/inventory";
import { selectEffectiveRecipe, snapshotInventoryCost } from "@/lib/inventory/inventory-domain";
import {
  getTableQrSecret,
  verifyTableQrToken,
} from "@/lib/customer-orders/table-qr-token";

type CustomerOrderItemModifierInput = {
  modifierId: string;
  qty?: number;
  groupName?: string;
  modifierName?: string;
  price?: number;
  isPlaceholder?: boolean;
};

type CustomerOrderItemInput = {
  productId: string;
  qty: number;
  modifiers?: CustomerOrderItemModifierInput[];
  assignedBaristaId?: string | null;
};

type CustomerOrderBody = {
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  tableToken?: string;
  items: CustomerOrderItemInput[];
};

type TableOrderContext = {
  id: string;
  name: string;
  tokenVersion: number;
};

class InactiveTableQrError extends Error {}

type PreparedLine = {
  productId: string;
  productName: string;
  qty: number;
  station: Station | null;
  assignedBaristaId: string | null;
  assignedBaristaName: string | null;
  unitPrice: number;
  lineTotal: number;
  costSnapshot: ReturnType<typeof snapshotInventoryCost>;
  modifiers: SelectedModifierLine[];
};

type SavedOrderItemForTicket = {
  id: string;
  productName: string;
  qty: number;
  station: Station | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  modifiers: SelectedModifierLine[];
};

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function isPlaceholderModifier(
  modifier: CustomerOrderItemModifierInput | SelectedModifierLine,
) {
  const modifierId =
    "modifierId" in modifier ? modifier.modifierId : modifier.optionId;
  const explicitPlaceholder =
    "isPlaceholder" in modifier ? modifier.isPlaceholder === true : false;

  return modifierId.startsWith("placeholder__") || explicitPlaceholder;
}

function buildCustomerOrderNote(
  customerName: string,
  customerPhone?: string,
  notes?: string,
) {
  const sections = [
    `Customer: ${customerName}`,
    customerPhone ? `Phone: ${customerPhone}` : null,
    notes ? `Note: ${notes}` : null,
  ].filter((value): value is string => Boolean(value));

  return sections.join(" | ");
}

async function createCustomerOrderRecord(
  tx: Prisma.TransactionClient,
  input: {
    total: Prisma.Decimal;
    notes: string | null;
    customerId: string | null;
    table: TableOrderContext | null;
  },
) {
  if (!input.table) {
    return tx.order.create({
      data: {
        type: "TAKEOUT",
        status: "OPEN",
        notes: input.notes,
        total: input.total,
        customerId: input.customerId,
      },
    });
  }

  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Table" WHERE "id" = ${input.table.id} FOR UPDATE`,
  );

  const currentTable = await tx.table.findUnique({
    where: { id: input.table.id },
    select: {
      isActive: true,
      qrOrderingEnabled: true,
      qrTokenVersion: true,
    },
  });
  if (
    !currentTable?.isActive ||
    !currentTable.qrOrderingEnabled ||
    currentTable.qrTokenVersion !== input.table.tokenVersion
  ) {
    throw new InactiveTableQrError();
  }

  const latestOpenOrder = await tx.order.findFirst({
    where: {
      tableId: input.table.id,
      status: "OPEN",
      type: "DINE_IN",
    },
    orderBy: [{ createdAt: "desc" }, { orderNumber: "desc" }],
    select: {
      id: true,
      orderNumber: true,
      tableCheck: { select: { id: true } },
    },
  });

  let tableCheckId = latestOpenOrder?.tableCheck?.id ?? null;
  let roundNumber = 1;

  if (latestOpenOrder?.tableCheck) {
    const roundAggregate = await tx.order.aggregate({
      where: { tableCheckId: latestOpenOrder.tableCheck.id },
      _max: { tableCheckRound: true },
    });
    roundNumber = (roundAggregate._max.tableCheckRound ?? 1) + 1;
  } else if (latestOpenOrder) {
    const legacyCheck = await tx.tableCheck.create({
      data: {
        checkNumber: latestOpenOrder.orderNumber,
        tableId: input.table.id,
      },
    });
    tableCheckId = legacyCheck.id;
    roundNumber = 2;

    await tx.order.update({
      where: { id: latestOpenOrder.id },
      data: { tableCheckId: legacyCheck.id, tableCheckRound: 1 },
    });
  }

  if (tableCheckId) {
    return tx.order.create({
      data: {
        type: "DINE_IN",
        status: "OPEN",
        notes: input.notes,
        total: input.total,
        tableId: input.table.id,
        tableCheckId,
        tableCheckRound: roundNumber,
      },
    });
  }

  const firstOrder = await tx.order.create({
    data: {
      type: "DINE_IN",
      status: "OPEN",
      notes: input.notes,
      total: input.total,
      tableId: input.table.id,
    },
  });
  const tableCheck = await tx.tableCheck.create({
    data: {
      checkNumber: firstOrder.orderNumber,
      tableId: input.table.id,
    },
  });

  return tx.order.update({
    where: { id: firstOrder.id },
    data: { tableCheckId: tableCheck.id, tableCheckRound: 1 },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CustomerOrderBody;
    const customerName = String(body.customerName ?? "").trim();
    const customerPhone = String(body.customerPhone ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const tableToken = String(body.tableToken ?? "").trim();

    let tableContext: TableOrderContext | null = null;
    let actorUserId: string | null = null;
    let customerId: string | null = null;

    if (tableToken) {
      let tokenPayload;
      try {
        tokenPayload = verifyTableQrToken(tableToken, getTableQrSecret());
      } catch {
        return NextResponse.json(
          { error: "Table ordering is not configured." },
          { status: 503 },
        );
      }

      if (tokenPayload) {
        const table = await prisma.table.findFirst({
          where: {
            id: tokenPayload.tableId,
            isActive: true,
            qrOrderingEnabled: true,
            qrTokenVersion: tokenPayload.tokenVersion,
          },
          select: { id: true, name: true },
        });
        tableContext = table
          ? { ...table, tokenVersion: tokenPayload.tokenVersion }
          : null;
      }

      if (!tableContext) {
        return NextResponse.json(
          { error: "This table ordering code is invalid or no longer active." },
          { status: 403 },
        );
      }
    } else {
      const authorization = await authorizeApi(PERMISSIONS.CUSTOMER_ORDER);
      if (!authorization.ok) return authorization.response;

      actorUserId = authorization.user.id;
      customerId =
        authorization.user.role === "CUSTOMER" ? authorization.user.id : null;
    }

    if (customerName.length < 2) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "No items provided." }, { status: 400 });
    }

    const productIds = [...new Set(body.items.map((item) => item.productId))];
    const modifierIds = [
      ...new Set(
        body.items.flatMap((item) =>
          Array.isArray(item.modifiers)
            ? item.modifiers.map((modifier) => modifier.modifierId)
            : [],
        ),
      ),
    ].filter((modifierId) => !modifierId.startsWith("placeholder__"));
    const assignedBaristaIds = [
      ...new Set(
        body.items
          .map((item) => item.assignedBaristaId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    const [products, modifierRecords, baristas] = await Promise.all([
      prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          cost: true,
          recipeVersions: {
            where: { isActive: true },
            select: { id: true, standardCost: true, costCoverage: true, effectiveFrom: true, effectiveTo: true, isActive: true },
          },
          category: {
            select: {
              station: true,
            },
          },
        },
      }),
      modifierIds.length > 0
        ? prisma.modifier.findMany({
            where: {
              id: { in: modifierIds },
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              price: true,
              productId: true,
              modifierGroup: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      assignedBaristaIds.length > 0 || tableContext
        ? prisma.user.findMany({
            where: {
              role: "BARISTA",
              isActive: true,
              ...(tableContext ? {} : { id: { in: assignedBaristaIds } }),
            },
            select: {
              id: true,
              fullName: true,
            },
            orderBy: { fullName: "asc" },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((product) => [product.id, product]));
    const modifierMap = new Map(
      modifierRecords.map((modifier) => [modifier.id, modifier]),
    );
    const baristaMap = new Map(baristas.map((barista) => [barista.id, barista]));

    const preparedLines: PreparedLine[] = [];
    let calculatedTotal = 0;

    for (const item of body.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return NextResponse.json(
          { error: `Product not found or inactive: ${item.productId}` },
          { status: 400 },
        );
      }

      const qty = Math.max(1, Number(item.qty) || 1);
      const station = product.category?.station ?? null;
      const incomingModifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      const selectedModifiers: SelectedModifierLine[] = [];
      const handledModifierIds = new Set<string>();

      for (const incomingModifier of incomingModifiers) {
        if (
          !incomingModifier?.modifierId ||
          handledModifierIds.has(incomingModifier.modifierId)
        ) {
          continue;
        }

        handledModifierIds.add(incomingModifier.modifierId);

        if (isPlaceholderModifier(incomingModifier)) {
          selectedModifiers.push({
            groupId: `placeholder-group-${incomingModifier.groupName ?? "custom"}`,
            groupName: incomingModifier.groupName?.trim() || "Custom",
            optionId: incomingModifier.modifierId,
            optionName: incomingModifier.modifierName?.trim() || "Custom option",
            price: roundCurrency(Math.max(0, Number(incomingModifier.price) || 0)),
            qty: Math.max(1, Number(incomingModifier.qty) || 1),
          });
          continue;
        }

        const modifier = modifierMap.get(incomingModifier.modifierId);

        if (!modifier || modifier.productId !== product.id) {
          throw new Error(
            `Modifier ${incomingModifier.modifierId} is invalid for product ${product.name}.`,
          );
        }

        selectedModifiers.push({
          groupId: modifier.modifierGroup.id,
          groupName: modifier.modifierGroup.name,
          optionId: modifier.id,
          optionName: modifier.name,
          price: roundCurrency(Number(modifier.price)),
          qty: Math.max(1, Number(incomingModifier.qty) || 1),
        });
      }

      let assignedBaristaId: string | null = null;
      let assignedBaristaName: string | null = null;

      if (station === "BARISTA") {
        const requestedBaristaId = tableContext
          ? null
          : item.assignedBaristaId;
        const barista = requestedBaristaId
          ? baristaMap.get(requestedBaristaId)
          : tableContext
            ? baristas[0]
            : null;

        if (!barista) {
          return NextResponse.json(
            { error: `No barista is available for ${product.name}.` },
            { status: 400 },
          );
        }

        assignedBaristaId = barista.id;
        assignedBaristaName = barista.fullName;
      }

      const modifierTotal = selectedModifiers.reduce(
        (sum, modifier) => sum + modifier.price * modifier.qty,
        0,
      );
      const unitPrice = roundCurrency(Number(product.price) + modifierTotal);
      const lineTotal = roundCurrency(unitPrice * qty);

      preparedLines.push({
        productId: product.id,
        productName: product.name,
        qty,
        station,
        assignedBaristaId,
        assignedBaristaName,
        unitPrice,
        lineTotal,
        costSnapshot: snapshotInventoryCost(
          selectEffectiveRecipe(product.recipeVersions, new Date()),
          product.cost,
        ),
        modifiers: selectedModifiers,
      });

      calculatedTotal += lineTotal;
    }

    calculatedTotal = roundCurrency(calculatedTotal);

    const savedOrderItems: SavedOrderItemForTicket[] = preparedLines.map((line) => ({
      id: crypto.randomUUID(),
      productName: line.productName,
      qty: line.qty,
      station: line.station,
      assignedUserId: line.assignedBaristaId,
      assignedUserName: line.assignedBaristaName,
      modifiers: line.modifiers,
    }));

    const orderNote = buildCustomerOrderNote(customerName, customerPhone, notes);

    const result = await prisma.$transaction(
      async (tx) => {
        const createdOrder = await createCustomerOrderRecord(tx, {
          total: toDecimal(calculatedTotal),
          notes: orderNote || null,
          customerId,
          table: tableContext,
        });

        await tx.orderItem.createMany({
          data: preparedLines.map((line, index) => ({
            id: savedOrderItems[index]?.id ?? crypto.randomUUID(),
            orderId: createdOrder.id,
            productId: line.productId,
            productName: line.productName,
            qty: line.qty,
            unitPrice: toDecimal(line.unitPrice),
            lineTotal: toDecimal(line.lineTotal),
            ...line.costSnapshot,
            station: line.station,
            assignedUserId: line.assignedBaristaId,
          })),
        });

        const modifierRows = preparedLines.flatMap((line, index) =>
          line.modifiers.flatMap((modifier) =>
            isPlaceholderModifier(modifier)
              ? []
              : [
                  {
                    orderItemId: savedOrderItems[index]?.id ?? "",
                    modifierId: modifier.optionId,
                    modifierName: modifier.optionName,
                    qty: modifier.qty,
                    price: toDecimal(modifier.price),
                  },
                ],
          ),
        );

        if (modifierRows.length > 0) {
          await tx.orderItemModifier.createMany({
            data: modifierRows,
          });
        }

        await createKitchenTicketState(tx, {
          orderId: createdOrder.id,
          lines: preparedLines,
          customerName,
          actorUserId,
        });

        const inventoryAlerts = await deductProductInventoryForSale(
          tx,
          preparedLines.map((line) => ({
            productId: line.productId,
            qty: line.qty,
          })),
          createdOrder.id,
          actorUserId,
        );

        return { order: createdOrder, inventoryAlerts };
      },
      { timeout: 15000, maxWait: 5000 },
    );

    await sendInventoryAlerts(result.inventoryAlerts);

    const order = result.order;
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: calculatedTotal,
        createdAt: order.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof InactiveTableQrError) {
      return NextResponse.json(
        { error: "This table ordering code is no longer active." },
        { status: 403 },
      );
    }

    console.error("Customer order error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create order.",
      },
      { status: 500 },
    );
  }
}
