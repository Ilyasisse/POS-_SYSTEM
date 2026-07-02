import type { LucideIcon } from "lucide-react";
import { CircleCheck } from "lucide-react";

export default function StatusRowCard({
  icon,
  label,
  status,
}: {
  icon: LucideIcon;
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
      {(() => {
        const Icon = icon;
        return <Icon className="size-5 text-success" />;
      })()}
      <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
        {label}
      </p>
      <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {status}
        <CircleCheck className="size-4" />
      </span>
    </div>
  );
}
