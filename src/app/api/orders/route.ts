import { OrderStatus, PaymentMethod, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderItemInput = {
  productId: string;
  quantity: number;
};

type DiscountMode = "none" | "percent" | "fixed";

type PaymentInput = {
  method: "cash" | "card";
  amount: number;
};

type CreateOrderPayload = {
  waiterName: string;
  notes?: string;
  discountMode?: DiscountMode;
  discountValue?: number;
  items: OrderItemInput[];
  payments: PaymentInput[];
};

function toCents(amount: number) {
  return Math.max(0, Math.round(amount * 100));
}

function clampDiscount(
  subtotalCents: number,
  mode: DiscountMode,
  value: number,
) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (mode === "percent") {
    return Math.min(subtotalCents, Math.round(subtotalCents * (Math.min(100, safeValue) / 100)));
  }
  if (mode === "fixed") {
    return Math.min(subtotalCents, toCents(safeValue));
  }
  return 0;
}

function mapPaymentMethod(method: "cash" | "card"): PaymentMethod {
  if (method === "cash") {
    return PaymentMethod.CASH;
  }
  return PaymentMethod.CARD;
}

function normalizeEmail(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return `${slug || "waiter"}@local.pos`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrderPayload;
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "Order must contain at least one item." }, { status: 400 });
    }

    const productIds = items.map((line) => line.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const orderLines = items.map((line) => {
      const product = productMap.get(line.productId);
      const qty = Math.max(1, Math.floor(line.quantity || 1));
      if (!product) {
        return null;
      }
      return {
        productId: product.id,
        qty,
        unitPriceCents: product.priceCents,
        lineTotalCents: product.priceCents * qty,
      };
    });

    if (orderLines.some((line) => line === null)) {
      return NextResponse.json({ error: "One or more products are invalid." }, { status: 400 });
    }

    const validLines = orderLines.filter((line): line is NonNullable<typeof line> => line !== null);
    const subtotalCents = validLines.reduce((sum, line) => sum + line.lineTotalCents, 0);

    const discountMode = body.discountMode ?? "none";
    const discountValue = body.discountValue ?? 0;
    const discountCents = clampDiscount(subtotalCents, discountMode, discountValue);
    const taxableCents = Math.max(0, subtotalCents - discountCents);

    const taxRate = await prisma.taxRate.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    const taxPercent = taxRate?.percent ?? 0;
    const taxCents = Math.round(taxableCents * (taxPercent / 100));
    const totalCents = taxableCents + taxCents;

    const waiterName = (body.waiterName || "Unknown Waiter").trim() || "Unknown Waiter";
    const waiterEmail = normalizeEmail(waiterName);

    const waiter = await prisma.user.upsert({
      where: { email: waiterEmail },
      update: {
        fullName: waiterName,
        role: UserRole.WAITER,
      },
      create: {
        email: waiterEmail,
        fullName: waiterName,
        role: UserRole.WAITER,
      },
    });

    let remaining = totalCents;
    const payments = (Array.isArray(body.payments) ? body.payments : [])
      .map((payment) => {
        const amountCents = Math.max(0, toCents(payment.amount));
        const appliedCents = Math.min(remaining, amountCents);
        remaining -= appliedCents;
        return {
          method: mapPaymentMethod(payment.method),
          amountCents: appliedCents,
          cashierId: waiter.id,
        };
      })
      .filter((payment) => payment.amountCents > 0);

    const order = await prisma.order.create({
      data: {
        cashierId: waiter.id,
        status: remaining <= 0 ? OrderStatus.PAID : OrderStatus.OPEN,
        notes: body.notes ?? null,
        subtotalCents,
        discountCents,
        taxRateId: taxRate?.id ?? null,
        taxCents,
        totalCents,
        items: {
          create: validLines,
        },
        payments: {
          create: payments,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.totalCents / 100,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to create order.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
