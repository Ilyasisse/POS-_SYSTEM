import type { LucideIcon } from "lucide-react";
import { Tone } from "@/types/admin.types";
import { getToneClasses } from "@/lib/admin/helper/getToneClasses";

export default function NotificationCard({
  icon,
  title,
  description,
  time,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  time: string;
  tone: Tone;
}) {
  const toneClasses = getToneClasses(tone);
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
      <div
        className={`grid size-11 shrink-0 place-items-center rounded-xl ${toneClasses.icon}`}
      >
        {(() => {
          const Icon = icon;
          return <Icon className="size-4" />;
        })()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="truncate text-sm font-medium text-slate-500">
          {description}
        </p>
      </div>
      <time className="shrink-0 text-xs font-semibold text-slate-500">
        {time}
      </time>
    </div>
  );
}
