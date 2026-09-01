import { NextResponse } from "next/server";
import { PaymentMethod, Prisma, type Station } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createKitchenTicketState } from "@/lib/kitchen/kitchen-tickets";
import type { SelectedModifierLine } from "@/lib/types";
import { selectEffectiveRecipe, snapshotInventoryCost } from "@/lib/inventory/inventory-domain";
import { getActiveWaiterOrderingShift } from "@/lib/waiter/waiter-shifts";
import {
  deductProductInventoryForSale,
  sendInventoryAlerts,
} from "@/lib/inventory/inventory";
import { isProductAvailableAt } from "@/lib/menu/product-availability";

type CompleteSaleItemModifierInput = {
  modifierId: string;
  qty?: number;
};

type CompleteSaleItemInput = {
  productId: string;
  qty: number;
  modifiers?: CompleteSaleItemModifierInput[];
  assignedBaristaId?: string | null;
};

type CompleteSaleBody = {
  items: CompleteSaleItemInput[];
  paymentMethod: PaymentMethod | string;
  notes?: string;
};

type PreparedModifier = SelectedModifierLine;

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
  modifiers: PreparedModifier[];
};

type SavedOrderItemForTicket = {
  id: string;
  productName: string;
  qty: number;
  station: Station | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  modifiers: PreparedModifier[];
};

const PAYMENT_METHODS = new Set<PaymentMethod>([
  "MYCASH",
  "GOLIS",
  "Dahabshiil",
  "OTHER",
]);

function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.has(value as PaymentMethod);
}

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

    if (!hasPermission(currentUser, PERMISSIONS.ORDER_CREATE)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (currentUser.role === "WAITER") {
      const activeShift = await getActiveWaiterOrderingShift(currentUser.id);

      if (!activeShift) {
        return NextResponse.json(
          {
            error:
              "Go to the cashier and enter your opening balance first before ordering.",
          },
          { status: 403 },
        );
      }
    }

    const body = (await request.json()) as CompleteSaleBody;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "No items provided." }, { status: 400 });
    }

    if (
      typeof body.paymentMethod !== "string" ||
      !isPaymentMethod(body.paymentMethod)
    ) {
      return NextResponse.json(
        { error: "Payment method is invalid." },
        { status: 400 },
      );
    }

    const paymentMethod: PaymentMethod = body.paymentMethod;

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
          id: {
            in: productIds,
          },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          cost: true,
          availabilityStartMinute: true,
          availabilityEndMinute: true,
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

    const now = new Date();
    const productMap = new Map(
      products
        .filter((product) => isProductAvailableAt(product, now))
        .map((product) => [product.id, product]),
    );
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
          { error: `Product not found, inactive, or unavailable now: ${item.productId}` },
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

      const selectedModifiers: PreparedModifier[] = uniqueModifierIds.map(
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

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          type: "DINE_IN",
          status: "PAID",
          notes: body.notes?.trim() || null,
          total: toDecimal(calculatedTotal),
          closedAt: new Date(),
          cashier: {
            connect: { id: currentUser.id },
          },
          waiter: {
            connect: { id: currentUser.id },
          },
        },
      });

      await tx.orderItem.createMany({
        data: preparedLines.map((line, index) => ({
          id: savedOrderItems[index]?.id ?? crypto.randomUUID(),
          orderId: order.id,
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
        orderId: order.id,
        lines: preparedLines,
        actorUserId: currentUser.id,
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          cashierId: currentUser.id,
          cashierName: currentUser.fullName,
          method: paymentMethod,
          amountPaid: toDecimal(calculatedTotal),
        },
      });

      const inventoryAlerts = await deductProductInventoryForSale(
        tx,
        preparedLines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
        })),
        order.id,
        currentUser.id,
      );

      return { order, savedOrderItems, inventoryAlerts };
    }, { timeout: 15000, maxWait: 5000 });

    await sendInventoryAlerts(result.inventoryAlerts);

    return NextResponse.json({
      success: true,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
      },
      receipt: {
        receiptNo: result.order.orderNumber,
        createdAt: result.order.createdAt.toISOString(),
        waiterName: currentUser.fullName,
        orderNote: body.notes ?? "",
        total: calculatedTotal,
        lines: result.savedOrderItems.map((saved, index) => ({
          id: saved.id,
          name: saved.productName,
          quantity: saved.qty,
          price: preparedLines[index]?.unitPrice ?? 0,
          finalPrice: preparedLines[index]?.lineTotal ?? 0,
          station: saved.station,
          selectedModifiers: saved.modifiers,
          assignedUserId: saved.assignedUserId,
          assignedUserName: saved.assignedUserName,
        })),
      },
    });
  } catch (error) {
    console.error("Complete sale error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to complete sale.",
      },
      { status: 500 },
    );
  }
}
