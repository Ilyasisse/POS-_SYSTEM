import { NextResponse } from "next/server";
import { Prisma, type Station } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { normalizeSomaliPhone } from "@/lib/payments/customer-ussd";
import type { SelectedModifierLine } from "@/lib/types";
import {
  selectEffectiveRecipe,
  snapshotInventoryCost,
} from "@/lib/inventory/inventory-domain";

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
  paymentPhone?: string;
  idempotencyKey?: string;
  notes?: string;
  items: CustomerOrderItemInput[];
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

export async function POST(request: Request) {
  try {
    const authorization = await authorizeApi(PERMISSIONS.CUSTOMER_ORDER);
    if (!authorization.ok) return authorization.response;

    const body = (await request.json()) as CustomerOrderBody;
    const customerName = String(body.customerName ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const payerPhone = normalizeSomaliPhone(String(body.paymentPhone ?? ""));
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();

    if (authorization.user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Customer sign-in is required." }, { status: 403 });
    }
    if (!payerPhone) {
      return NextResponse.json({ error: "Enter the phone number sending the payment." }, { status: 400 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      return NextResponse.json({ error: "Invalid checkout key." }, { status: 400 });
    }

    if (customerName.length < 2) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "No items provided." },
        { status: 400 },
      );
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
            select: {
              id: true,
              standardCost: true,
              costCoverage: true,
              effectiveFrom: true,
              effectiveTo: true,
              isActive: true,
            },
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
        ? prisma.staff.findMany({
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

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );
    const modifierMap = new Map(
      modifierRecords.map((modifier) => [modifier.id, modifier]),
    );
    const baristaMap = new Map(
      baristas.map((barista) => [barista.id, barista]),
    );

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
      const incomingModifiers = Array.isArray(item.modifiers)
        ? item.modifiers
        : [];
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
            optionName:
              incomingModifier.modifierName?.trim() || "Custom option",
            price: roundCurrency(
              Math.max(0, Number(incomingModifier.price) || 0),
            ),
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
        if (!item.assignedBaristaId) {
          return NextResponse.json(
            { error: `No barista is available for ${product.name}.` },
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

    if (calculatedTotal <= 0) {
      return NextResponse.json({ error: "The checkout amount must be positive." }, { status: 400 });
    }

    const existing = await prisma.customerCheckout.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.customerId !== authorization.user.id) {
        return NextResponse.json({ error: "Checkout key is already in use." }, { status: 409 });
      }
      return NextResponse.json({ checkout: { id: existing.id, amount: Number(existing.amount), status: existing.status } });
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const snapshot = JSON.parse(JSON.stringify(preparedLines)) as Prisma.InputJsonValue;
    try {
      const checkout = await prisma.customerCheckout.create({
        data: {
          customerId: authorization.user.id,
          customerName,
          payerPhone,
          notes: notes || null,
          amount: toDecimal(calculatedTotal),
          snapshot,
          idempotencyKey,
          expiresAt,
        },
      });
      return NextResponse.json({ checkout: { id: checkout.id, amount: calculatedTotal, status: checkout.status } }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const checkout = await prisma.customerCheckout.findUnique({ where: { idempotencyKey } });
        if (checkout?.customerId === authorization.user.id) {
          return NextResponse.json({ checkout: { id: checkout.id, amount: Number(checkout.amount), status: checkout.status } });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Customer checkout error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start checkout." }, { status: 500 });
  }
}