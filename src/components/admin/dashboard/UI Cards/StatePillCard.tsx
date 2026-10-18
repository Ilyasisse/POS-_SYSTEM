import type { LucideIcon } from "lucide-react";
import { Tone } from "@/types/admin/admin.types";
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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneClasses.soft}`}
      >
        {(() => {
          const Icon = icon;
          return <Icon className="size-4" />;
        })()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-black text-foreground">{value}</p>
      </div>
    </div>
  );
}
