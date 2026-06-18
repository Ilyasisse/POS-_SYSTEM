import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Tone } from "@/types/admin.types";
import { getToneClasses } from "@/lib/admin/helper/getToneClasses";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
FontAwesomeIcon

export default function ActivityItemCard({
  icon,
  text,
  time,
  tone,
  urgent,
}: {
  icon: IconDefinition;
  text: string;
  time: string;
  tone: Tone;
  urgent?: boolean;
}) {
  const toneClasses = getToneClasses(tone);
  return <div className="flex items-center gap-3 py-2">
      <div
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${toneClasses.icon}`}
      >
        <FontAwesomeIcon icon={icon} className="text-xs" />
      </div>
      <p
        className={`min-w-0 flex-1 truncate text-sm font-medium ${
          urgent ? "text-red-600" : "text-slate-700"
        }`}
      >
        {text}
      </p>
      <time className="shrink-0 text-xs font-semibold text-slate-500">
        {time}
      </time>
    </div>;
}
