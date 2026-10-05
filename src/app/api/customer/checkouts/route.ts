import { NextResponse } from "next/server";
import { Prisma, type Station } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/auth/api-authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { normalizeCustomerPaymentPhone } from "@/lib/payments/customer-ussd";
import { verifyTableQrToken } from "@/lib/customer-orders/table-qr-token";
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
  orderType?: "DINE_IN" | "TAKEOUT";
  tableId?: string | null;
  tableToken?: string;
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

class InactiveTableQrError extends Error {}

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
    const customerName = String(
      body.customerName ?? authorization.user.fullName,
    ).trim();
    let orderType = body.orderType ?? "TAKEOUT";
    let tableId =
      orderType === "DINE_IN" ? String(body.tableId ?? "").trim() : null;
    const tableToken = String(body.tableToken ?? "").trim();
    const payerPhone = normalizeCustomerPaymentPhone(
      String(body.paymentPhone ?? ""),
    );
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();
    let tableQrPayload: ReturnType<typeof verifyTableQrToken> = null;

    if (authorization.user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Customer sign-in is required." },
        { status: 403 },
      );
    }
    if (!payerPhone) {
      return NextResponse.json(
        {
          error:
            "Enter 90 followed by seven digits for the phone sending payment.",
        },
        { status: 400 },
      );
    }
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idempotencyKey,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid checkout key." },
        { status: 400 },
      );
    }

    // Recover the original checkout even if its table code was rotated meanwhile.
    const existing = await prisma.customerCheckout.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.customerId !== authorization.user.id) {
        return NextResponse.json(
          { error: "Checkout key is already in use." },
          { status: 409 },
        );
      }
      return NextResponse.json({
        checkout: {
          id: existing.id,
          amount: Number(existing.amount),
          status: existing.status,
        },
      });
    }

    if (tableToken) {
      try {
        tableQrPayload = verifyTableQrToken(tableToken);
      } catch {
        return NextResponse.json(
          { error: "Table ordering is not configured." },
          { status: 503 },
        );
      }
      const table = tableQrPayload
        ? await prisma.table.findFirst({
            where: {
              id: tableQrPayload.tableId,
              isActive: true,
              qrOrderingEnabled: true,
              qrTokenVersion: tableQrPayload.tokenVersion,
            },
            select: { id: true },
          })
        : null;
      if (!table) {
        return NextResponse.json(
          { error: "This table ordering code is invalid or no longer active." },
          { status: 403 },
        );
      }
      // A scanned code binds the destination; submitted table IDs cannot override it.
      orderType = "DINE_IN";
      tableId = table.id;
    }

    if (orderType !== "DINE_IN" && orderType !== "TAKEOUT") {
      return NextResponse.json(
        { error: "Choose dine-in or to-go." },
        { status: 400 },
      );
    }
    if (
      orderType === "DINE_IN" &&
      (!tableId ||
        !(await prisma.table.findFirst({
          where: { id: tableId, isActive: true },
          select: { id: true },
        })))
    ) {
      return NextResponse.json(
        { error: "Select an active table." },
        { status: 400 },
      );
    }

    if (customerName.length < 1) {
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
      tableToken || assignedBaristaIds.length > 0
        ? prisma.staff.findMany({
            where: {
              ...(tableToken ? {} : { id: { in: assignedBaristaIds } }),
              role: "BARISTA",
              isActive: true,
            },
            select: {
              id: true,
              fullName: true,
            },
            orderBy: [{ fullName: "asc" }, { id: "asc" }],
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
        const selectedBaristaId =
          item.assignedBaristaId || (tableToken ? baristas[0]?.id : null);
        if (!selectedBaristaId) {
          return NextResponse.json(
            { error: `No barista is available for ${product.name}.` },
            { status: 400 },
          );
        }

        const barista = baristaMap.get(selectedBaristaId);

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
      return NextResponse.json(
        { error: "The checkout amount must be positive." },
        { status: 400 },
      );
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const snapshot = JSON.parse(
      JSON.stringify(preparedLines),
    ) as Prisma.InputJsonValue;
    try {
      const checkoutData = {
        data: {
          customerId: authorization.user.id,
          customerName,
          payerPhone,
          orderType,
          tableId,
          amount: toDecimal(calculatedTotal),
          snapshot,
          idempotencyKey,
          expiresAt,
        },
      };
      const qrPayload = tableQrPayload;
      const checkout = qrPayload
        ? await prisma.$transaction(async (tx) => {
            // Serialize new checkout creation with table-code revocation.
            await tx.$queryRaw`SELECT "id" FROM "Table" WHERE "id" = ${qrPayload.tableId} FOR UPDATE`;
            const table = await tx.table.findUnique({
              where: { id: qrPayload.tableId },
              select: {
                isActive: true,
                qrOrderingEnabled: true,
                qrTokenVersion: true,
              },
            });
            if (
              !table?.isActive ||
              !table.qrOrderingEnabled ||
              table.qrTokenVersion !== qrPayload.tokenVersion
            ) {
              throw new InactiveTableQrError(
                "This table ordering code is invalid or no longer active.",
              );
            }
            return tx.customerCheckout.create(checkoutData);
          })
        : await prisma.customerCheckout.create(checkoutData);
      return NextResponse.json(
        {
          checkout: {
            id: checkout.id,
            amount: calculatedTotal,
            status: checkout.status,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof InactiveTableQrError) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const checkout = await prisma.customerCheckout.findUnique({
          where: { idempotencyKey },
        });
        if (checkout?.customerId === authorization.user.id) {
          return NextResponse.json({
            checkout: {
              id: checkout.id,
              amount: Number(checkout.amount),
              status: checkout.status,
            },
          });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Customer checkout error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start checkout.",
      },
      { status: 500 },
    );
  }
}
