import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/shared";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { supplyDisplayQuantity, supplyStockUnit } from "@/lib/inventory/supply-units";
import SupplyDetailsForm from "./SupplyDetailsForm";

export default async function SupplyDetailsPage({
  params,
}: {
  params: Promise<{ supplyId: string }>;
}) {
  await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const { supplyId } = await params;
  const supply = await prisma.inventorySupply.findUnique({ where: { id: supplyId } });
  if (!supply?.isActive) notFound();
  const stockUnit = supplyStockUnit(supply);
  return (
    <AdminPage title={supply.name} description="Edit this inventory supply and its stock settings.">
      <Link href="/admin/inventory" className="text-sm underline">
        Back to inventory
      </Link>
      <SupplyDetailsForm
        key={supply.updatedAt.toISOString()}
        supply={{
          id: supply.id,
          name: supply.name,
          unit: stockUnit.label,
          stockQty: supplyDisplayQuantity(supply.stockQty, stockUnit.factor),
          lowStockThreshold: supplyDisplayQuantity(supply.lowStockThreshold, stockUnit.factor),
          version: supply.updatedAt.toISOString(),
        }}
      />
    </AdminPage>
  );
}
