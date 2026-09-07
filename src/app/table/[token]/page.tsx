import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CustomerOrderPage from "@/components/customer/CustomerOrderPage";
import {
  getTableQrSecret,
  verifyTableQrToken,
} from "@/lib/customer-orders/table-qr-token";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order at Your Table | Mash Allah Cafe",
  description: "Scan, choose your items, and send your dine-in order to the kitchen.",
  robots: { index: false, follow: false },
};

type TableOrderPageProps = {
  params: Promise<{ token: string }>;
};

export default async function TableOrderPage({ params }: TableOrderPageProps) {
  const { token } = await params;

  let tokenPayload = null;
  try {
    tokenPayload = verifyTableQrToken(token, getTableQrSecret());
  } catch {
    notFound();
  }
  if (!tokenPayload) notFound();

  const table = await prisma.table.findFirst({
    where: {
      id: tokenPayload.tableId,
      isActive: true,
      qrOrderingEnabled: true,
      qrTokenVersion: tokenPayload.tokenVersion,
    },
    select: { id: true, name: true },
  });
  if (!table) notFound();

  return (
    <CustomerOrderPage
      tableOrderContext={{
        token,
        tableName: table.name,
      }}
    />
  );
}
