type Tone = "blue" | "green" | "purple" | "orange" | "pink" | "slate";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getToneClasses } from "@/lib/admin/helper/getToneClasses";

export default function StateCard({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  description: string;
  tone: Tone;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <Card className="p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-center gap-4">
        <div
          className={`grid size-14 shrink-0 place-items-center rounded-2xl ${toneClasses.icon}`}
        >
          {(() => {
            const Icon = icon;
            return <Icon className="size-6" />;
          })()}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {label}
          </p>

          <p className="text-3xl font-semibold leading-tight">{value}</p>

          <p className="truncate text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}
