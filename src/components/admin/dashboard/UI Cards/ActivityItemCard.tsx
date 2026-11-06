import type { LucideIcon } from "lucide-react";
import { Tone } from "@/types/admin/admin.types";
import { getToneClasses } from "@/lib/admin/helper/getToneClasses";

export default function ActivityItemCard({
  icon,
  text,
  time,
  tone,
  urgent,
}: {
  icon: LucideIcon;
  text: string;
  time: string;
  tone: Tone;
  urgent?: boolean;
}) {
  const toneClasses = getToneClasses(tone);
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${toneClasses.icon}`}
      >
        {(() => {
          const Icon = icon;
          return <Icon className="size-3.5" />;
        })()}
      </div>
      <p
        className={`min-w-0 flex-1 truncate text-sm font-medium ${
          urgent ? "text-red-600 dark:text-red-300" : "text-foreground"
        }`}
      >
        {text}
      </p>
      <time className="shrink-0 text-xs font-semibold text-muted-foreground">
        {time}
      </time>
    </div>
  );
}
