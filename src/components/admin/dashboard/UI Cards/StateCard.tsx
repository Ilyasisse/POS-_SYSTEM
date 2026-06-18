type Tone = "blue" | "green" | "purple" | "orange" | "pink" | "slate";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getToneClasses } from "@/lib/admin/helper/getToneClasses";

export default function StateCard({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: IconDefinition;
  label: string;
  value: number | string;
  description: string;
  tone: Tone;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-center gap-4">
        <div
          className={`grid size-14 shrink-0 place-items-center rounded-2xl ${toneClasses.icon}`}
        >
          <FontAwesomeIcon icon={icon} className="text-2xl" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-600">
            {label}
          </p>

          <p className="text-3xl font-black leading-tight text-slate-950">
            {value}
          </p>

          <p className="truncate text-sm font-medium text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}
