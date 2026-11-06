import { MetricCard } from "@/components/admin/shared";
import { StatusSummary } from "@/types/admin/Inventory.types";

export default function InventorySummary({
  summary,
  takenTodayCount,
}: {
  summary: StatusSummary;
  takenTodayCount: number;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="In Stock"
        value={summary.ok}
        helper="Healthy supplies"
      />
      <MetricCard
        label="Low Stock"
        value={summary.low}
        helper="Needs attention"
      />
      <MetricCard
        label="Out of Stock"
        value={summary.out}
        helper="Restock now"
      />
      <MetricCard
        label="Taken Today"
        value={takenTodayCount}
        helper="Since 12:00 AM EAT"
      />
    </section>
  );
}
