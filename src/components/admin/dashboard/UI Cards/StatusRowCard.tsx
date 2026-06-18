import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";

export default function StatusRowCard({
  icon,
  label,
  status,
}: {
  icon: IconDefinition;
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
      <FontAwesomeIcon icon={icon} className="w-5 text-emerald-600" />
      <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
        {label}
      </p>
      <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {status}
        <FontAwesomeIcon icon={faCircleCheck} />
      </span>
    </div>
  );
}
