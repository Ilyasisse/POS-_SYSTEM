import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const payments = await prisma.payment.findMany({});
    const products = await prisma.product.findMany({});
    const product_fix = await prisma.product.updateMany({
     data:{
      isActive: false      
     }
    })
    return NextResponse.json({ payments, products , product_fix });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}
