import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

type AdminButtonProps = {
  children: ReactNode;
  icon?: IconDefinition;
  type?: "button" | "submit";
};

/**
 * Renders the shared primary admin button for form and page actions.
 *
 * @param props - Admin button options.
 * @param props.children - The visible button label.
 * @param props.icon - Optional FontAwesome icon shown before the label.
 * @param props.type - The button type, either button or submit.
 * @returns The rendered primary admin button.
 *
 * @remarks Used by the tables, settings, reports, profile, and inventory admin pages.
 */
export function AdminButton({
  children,
  icon,
  type = "button",
}: AdminButtonProps) {
  return (
    <button
      type={type}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
    >
      {icon ? <FontAwesomeIcon icon={icon} className="text-xs" /> : null}
      {children}
    </button>
  );
}
