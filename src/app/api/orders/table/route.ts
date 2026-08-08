import { NextResponse } from "next/server";
import { Prisma, type Station } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createKitchenTicketState } from "@/lib/kitchen/kitchen-tickets";
import type { SelectedModifierLine } from "@/lib/types";
import { selectEffectiveRecipe, snapshotInventoryCost } from "@/lib/inventory/inventory-domain";
import {
  deductProductInventoryForSale,
  sendInventoryAlerts,
} from "@/lib/inventory/inventory";

type TableOrderItemModifierInput = {
  modifierId: string;
  qty?: number;
};

type TableOrderItemInput = {
  productId: string;
  qty: number;
  modifiers?: TableOrderItemModifierInput[];
  assignedBaristaId?: string | null;
};

type TableOrderBody = {
  tableId?: string;
  items: TableOrderItemInput[];
  notes?: string;
};

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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!currentUser || !currentUser.isActive) {
      return NextResponse.json(
        { error: "Staff account not found." },
        { status: 403 },
      );
    }

    if (!hasPermission(currentUser, PERMISSIONS.ORDER_MANAGE)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = (await request.json()) as TableOrderBody;
    const tableId = String(body.tableId ?? "").trim();

    if (!tableId) {
      return NextResponse.json(
        { error: "Select a table before sending the order." },
        { status: 400 },
      );
    }

    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!table) {
      return NextResponse.json(
        { error: "Selected table is not active." },
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
    ];
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
      assignedBaristaIds.length > 0
        ? prisma.user.findMany({
            where: {
              id: { in: assignedBaristaIds },
              role: "BARISTA",
              isActive: true,
            },
            select: {
              id: true,
              fullName: true,
            },
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
      const itemModifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      const incomingModifierMap = new Map<
        string,
        (typeof itemModifiers)[number]
      >();

      for (const modifier of itemModifiers) {
        if (!incomingModifierMap.has(modifier.modifierId)) {
          incomingModifierMap.set(modifier.modifierId, modifier);
        }
      }

      const uniqueModifierIds = Array.from(incomingModifierMap.keys());

      const selectedModifiers: SelectedModifierLine[] = uniqueModifierIds.map(
        (modifierId) => {
          const modifier = modifierMap.get(modifierId);

          if (!modifier || modifier.productId !== product.id) {
            throw new Error(
              `Modifier ${modifierId} is invalid for product ${product.name}.`,
            );
          }

          const incomingModifier = incomingModifierMap.get(modifierId);

          return {
            groupId: modifier.modifierGroup.id,
            groupName: modifier.modifierGroup.name,
            optionId: modifier.id,
            optionName: modifier.name,
            price: roundCurrency(Number(modifier.price)),
            qty: Math.max(1, Number(incomingModifier?.qty) || 1),
          };
        },
      );

      let assignedBaristaId: string | null = null;
      let assignedBaristaName: string | null = null;

      if (station === "BARISTA") {
        if (!item.assignedBaristaId) {
          return NextResponse.json(
            { error: `Select a barista for ${product.name}.` },
            { status: 400 },
          );
        }

        const barista = baristaMap.get(item.assignedBaristaId);

        if (!barista) {
          return NextResponse.json(
            { error: `Assigned barista not found for ${product.name}.` },
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

    const result = await prisma.$transaction(
      async (tx) => {
        const createdOrder = await tx.order.create({
          data: {
            type: "DINE_IN",
            status: "OPEN",
            notes: body.notes?.trim() || null,
            total: toDecimal(calculatedTotal),
            table: {
              connect: { id: table.id },
            },
            cashier: {
              connect: { id: currentUser.id },
            },
          },
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
          line.modifiers.map((modifier) => ({
            orderItemId: savedOrderItems[index]?.id ?? "",
            modifierId: modifier.optionId,
            modifierName: modifier.optionName,
            qty: modifier.qty,
            price: toDecimal(modifier.price),
          })),
        );

        if (modifierRows.length > 0) {
          await tx.orderItemModifier.createMany({
            data: modifierRows,
          });
        }

        await createKitchenTicketState(tx, {
          orderId: createdOrder.id,
          lines: preparedLines,
        });

        const inventoryAlerts = await deductProductInventoryForSale(
          tx,
          preparedLines.map((line) => ({
            productId: line.productId,
            qty: line.qty,
          })),
          createdOrder.id,
          currentUser.id,
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
        tableName: table.name,
        total: calculatedTotal,
        createdAt: order.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Table order error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create table order.",
      },
      { status: 500 },
    );
  }
}
