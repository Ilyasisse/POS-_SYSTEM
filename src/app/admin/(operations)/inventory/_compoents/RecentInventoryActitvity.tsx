import Link from "next/link";
import { ToneBadge } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { InventoryMovementRow } from "@/types/admin/Inventory.types";

function formatDateTime(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });
}

export default function RecentInventoryActivity({
  movements,
}: {
  movements: InventoryMovementRow[];
}) {
  return (
    <Card className="p-5">
      <h2 className="text-foreground text-lg font-black">Recent Inventory Activity</h2>
      <Link
        href="/admin/inventory/activity"
        className="text-primary text-sm font-semibold underline"
      >
        View all activity
      </Link>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {movements.length === 0 ? (
          <p className="text-muted-foreground text-sm font-medium">No supply movements yet.</p>
        ) : (
          movements.map((movement) => (
            <div
              key={movement.id}
              className="border-border bg-card flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-black">{movement.itemName}</p>
                <p className="text-muted-foreground text-xs font-medium">
                  {movement.reason} ~ {formatDateTime(movement.occurredAt)}
                </p>
              </div>
              <ToneBadge tone={movement.delta.startsWith("-") ? "red" : "green"}>
                {Number(movement.delta) > 0 ? "+" : ""}
                {movement.deltaLabel}
              </ToneBadge>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
