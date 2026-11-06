import { ToneBadge } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { InventoryMovementRow } from "@/types/admin/Inventory.types";

function formatDateTime(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
      <h2 className="text-lg font-black text-foreground">
        Recent Inventory Activity
      </h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {movements.length === 0 ? (
          <p className="text-sm font-medium text-muted-foreground">
            No supply movements yet.
          </p>
        ) : (
          movements.map((movement) => (
            <div
              key={movement.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-foreground">
                  {movement.itemName}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {movement.reason} ~ {formatDateTime(movement.createdAt)}
                </p>
              </div>
              <ToneBadge tone={movement.delta < 0 ? "red" : "green"}>
                {movement.delta > 0 ? "+" : ""}
                {movement.delta}
              </ToneBadge>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
