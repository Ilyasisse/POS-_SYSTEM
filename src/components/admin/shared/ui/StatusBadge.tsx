type StatusBadgeProps = {
  active: boolean;
  label?: string;
};

/**
 * Renders the standard active/inactive status badge.
 *
 * @param props - Status badge options.
 * @param props.active - Whether the badge should show the active state.
 * @param props.label - Optional custom label to show instead of Active or Inactive.
 * @returns The rendered status badge.
 *
 * @remarks Used by the staff, modifiers, categories, products, and modifier groups admin pages.
 */
export function StatusBadge({ active, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {label ?? (active ? "Active" : "Inactive")}
    </span>
  );
}
