import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Tone } from "@/types/admin.types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getToneClasses } from "@/lib/admin/helper/getToneClasses";

export default function NotificationCard({
  icon,
  title,
  description,
  time,
  tone,
}: {
  icon: IconDefinition;
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
        <FontAwesomeIcon icon={icon} />
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
