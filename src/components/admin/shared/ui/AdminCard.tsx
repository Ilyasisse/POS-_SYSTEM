import type { ReactNode } from "react";

type AdminCardProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Renders the shared bordered white card surface used across admin layouts.
 *
 * @param props - Admin card options.
 * @param props.children - The card content.
 * @param props.className - Optional extra Tailwind classes added to the card.
 * @returns The rendered admin card section.
 *
 * @remarks Used by the tables, settings, reports, inventory, and profile admin pages,
 * and internally by AdminStatCard and AdminTableShell.
 */
export function AdminCard({ children, className = "" }: AdminCardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70 ${className}`}
    >
      {children}
    </section>
  );
}
