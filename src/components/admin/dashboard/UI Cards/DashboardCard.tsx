import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function DashboardCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: IconDefinition;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FontAwesomeIcon icon={icon} className="text-blue-600" />
          <h2 className="truncate text-base font-black text-slate-950 sm:text-lg">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
