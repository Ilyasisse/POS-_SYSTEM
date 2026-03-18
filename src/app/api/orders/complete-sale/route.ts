import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CompleteSaleItemModifier = {
  modifierId: string;
  modifierName: string;
  price: number;
  qty: number;
};

type CompleteSaleItem = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  modifiers?: CompleteSaleItemModifier[];
};

type CompleteSaleBody = {
  items: CompleteSaleItem[];
  total: number;
  paymentMethod: "MYCASH" | "GOLIS" | "Dahabshiil" | "OTHER";
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CompleteSaleBody;

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: "No items provided." },
        { status: 400 }
      );
    }

    if (typeof body.total !== "number") {
      return NextResponse.json(
        { error: "Total is required." },
        { status: 400 }
      );
    }

    if (!body.paymentMethod) {
      return NextResponse.json(
        { error: "Payment method is required." },
        { status: 400 }
      );
    }

    // 1) Load product station info from DB
    const productIds = [...new Set(body.items.map((item) => item.productId))];

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: {
        id: true,
        name: true,
        category:{
          select:{
            id:true,
            name:true,
            station:true
          }
        }
      },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    console.log(
      "api complete-sale product lookup:",
      body.items.map((item) => {
        const product = productMap.get(item.productId);
        return {
          productId: item.productId,
          name: item.productName,
          dbName: product?.name,
          station: product?.category?.station,
        };
      })
    );

    const cashier = await prisma.user.findFirst({
      where: {
        role: "CASHIER",
      },
    });

    if (!cashier) {
      return NextResponse.json(
        { error: "No cashier user found in database." },
        { status: 400 }
      );
    }

    const order = await prisma.order.create({
      data: {
        type: "DINE_IN",
        status: "PAID",
        notes: body.notes ?? null,
        total: body.total,
        cashierId: cashier.id,
        closedAt: new Date(),
      },
    });

    for (const item of body.items) {
      const product = productMap.get(item.productId);

      const orderItem = await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        },
      });

      if (item.modifiers?.length) {
        for (const modifier of item.modifiers) {
          await prisma.orderItemModifier.create({
            data: {
              orderItemId: orderItem.id,
              modifierId: modifier.modifierId,
              modifierName: modifier.modifierName,
              qty: modifier.qty,
              price: modifier.price,
            },
          });
        }
      }

      console.log("saved order item:", {
        productId: item.productId,
        productName: item.productName,
        station: product?.category?.station,
      });
    }

    await prisma.payment.create({
      data: {
        orderId: order.id,
        cashierId: cashier.id,
        cashierName: cashier.fullName,
        method: body.paymentMethod,
        amountPaid: body.total,
      },
    });

    const receiptLines = body.items.map((item, index) => {
      const product = productMap.get(item.productId);

      return {
        id: `${item.productId}-${index}`,
        name: item.productName,
        quantity: item.qty,
        lineTotal: item.lineTotal,
        station: product?.category?.station ?? null,
      };
    });

    console.log("receipt lines with station:", receiptLines);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
      },
      receipt: {
        receiptNo: order.orderNumber,
        createdAt: order.createdAt.toISOString(),
        lines: receiptLines,
      },
    });
  } catch (error) {
    console.error("Complete sale error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to complete sale.",
      },
      { status: 500 }
    );
  }
}