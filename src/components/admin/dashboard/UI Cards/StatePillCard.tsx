import type { LucideIcon } from "lucide-react";
import { Tone } from "@/types/admin.types";
import { getToneClasses } from "@/lib/admin/helper/getToneClasses";

export default function StatePillCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: Tone;
}) {
  // Resolves the requested tone into reusable Tailwind class names.
  const toneClasses = getToneClasses(tone);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneClasses.soft}`}
      >
        {(() => {
          const Icon = icon;
          return <Icon className="size-4" />;
        })()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
        <p className="truncate text-sm font-black text-slate-950">{value}</p>
      </div>
    </div>
  );
}
