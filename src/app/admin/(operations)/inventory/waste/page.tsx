import Link from "next/link";
import { AdminPage, Card } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";
import { canonicalUnitLabel } from "@/lib/inventory/inventory-domain";
import { prisma } from "@/lib/prisma";
import { WasteForm } from "./WasteForm";

export const dynamic = "force-dynamic";

export default async function InventoryWastePage() {
  await requirePermission(PERMISSIONS.INVENTORY_MANAGE);
  const [supplies, events] = await Promise.all([
    prisma.inventorySupply.findMany({
      where: { isActive: true, canonicalUnit: { not: null } },
      select: { id: true, name: true, canonicalUnit: true, stockQty: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockEvent.findMany({
      where: {
        supplyId: { not: null },
        type: { in: ["WASTE", "SPOILAGE", "DAMAGE"] },
      },
      orderBy: { occurredAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        quantityDelta: true,
        canonicalUnit: true,
        reason: true,
        occurredAt: true,
        supply: { select: { name: true } },
        actor: { select: { fullName: true } },
      },
    }),
  ]);
  return (
    <AdminPage
      title="Inventory waste"
      description="Record spoiled, damaged, or discarded supplies with an audit trail."
      action={
        <Button variant="outline" asChild>
          <Link href="/admin/inventory">Back to inventory</Link>
        </Button>
      }
    >
      <Card className="p-5">
        <h2 className="mb-2 text-lg font-bold">Record stock loss</h2>
        <p className="mb-5 text-sm text-slate-600">
          Quantities use canonical units (g, ml, or pieces). Each entry deducts
          stock immediately. Use inventory counts for unexplained shortages.
        </p>
        <WasteForm
          supplies={supplies.map((supply) => ({
            id: supply.id,
            name: supply.name,
            unit: canonicalUnitLabel(supply.canonicalUnit),
            stockQty: supply.stockQty.toString(),
          }))}
        />
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-bold">Recent recorded losses</h2>
        {events.length ? (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="border-b pb-3 text-sm">
                <strong>{event.supply?.name ?? "Archived supply"}</strong> ·{" "}
                {event.type.toLowerCase()} ·{" "}
                {event.quantityDelta.abs().toString()}{" "}
                {canonicalUnitLabel(event.canonicalUnit)}{" "}
                {event.actor?.fullName ? `· ${event.actor.fullName}` : ""}
                <span className="block text-slate-600">
                  {event.reason} ·{" "}
                  {event.occurredAt.toLocaleString("en-US", {
                    timeZone: "Africa/Nairobi",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            No waste, spoilage, or damage recorded yet.
          </p>
        )}
      </Card>
    </AdminPage>
  );
}
