import { AdminCard } from "./AdminCard";

type AdminStatCardProps = {
  label: string;
  value: number | string;
  helper?: string;
};

/**
 * Renders a compact metric card with an optional helper line.
 *
 * @param props - Admin stat card options.
 * @param props.label - The metric label shown above the value.
 * @param props.value - The metric value to display.
 * @param props.helper - Optional helper text shown below the value.
 * @returns The rendered admin stat card.
 *
 * @remarks Used by the inventory, orders, settings, reports, tables, and staff admin pages.
 */
export function AdminStatCard({ label, value, helper }: AdminStatCardProps) {
  return (
    <AdminCard className="p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs font-medium text-slate-500">{helper}</p> : null}
    </AdminCard>
  );
}
