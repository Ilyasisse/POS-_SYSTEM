import { Tone } from "@/types/admin.types";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { getToneClasses } from "@/lib/admin/helper/getToneClasses";

export default function QuickAccessCard({
  href,
  icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: Tone;
}) {
  const toneClasses = getToneClasses(tone);
  return (
    <Link
      href={href}
      className="group flex min-h-32 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <span
        className={`grid size-12 place-items-center rounded-2xl transition group-hover:scale-105 ${toneClasses.icon}`}
      >
        {(() => {
          const Icon = icon;
          return <Icon className="size-5" />;
        })()}
      </span>
      <span className="mt-3 text-sm font-black text-slate-950">{title}</span>
      <span className="mt-1 text-xs font-medium text-slate-500">
        {description}
      </span>
    </Link>
  );
}
