import type { ReactNode } from "react";

type ToneBadgeProps = {
  tone: "green" | "red" | "amber" | "blue" | "slate";
  children: ReactNode;
};

/**
 * Renders a small badge with one of the shared admin tone colors.
 *
 * @param props - Tone badge options.
 * @param props.tone - The color tone used for the badge styling.
 * @param props.children - The badge label content.
 * @returns The rendered tone badge.
 *
 * @remarks Used by the tables, inventory, reports, profile, and orders admin pages.
 */
export function ToneBadge({ tone, children }: ToneBadgeProps) {
  const classes = {
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${classes}`}>
      {children}
    </span>
  );
}
