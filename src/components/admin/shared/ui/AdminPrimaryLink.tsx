import Link from "next/link";
import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

type AdminPrimaryLinkProps = {
  href: string;
  children: ReactNode;
  icon?: IconDefinition;
};

/**
 * Renders a primary admin navigation link with an icon.
 *
 * @param props - Admin primary link options.
 * @param props.href - The destination path for the link.
 * @param props.children - The visible link label.
 * @param props.icon - Optional FontAwesome icon shown before the label.
 * @returns The rendered primary admin link.
 *
 * @remarks Used by the modifier groups, products, categories, and modifiers admin pages.
 */
export function AdminPrimaryLink({
  href,
  children,
  icon = faPlus,
}: AdminPrimaryLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
    >
      <FontAwesomeIcon icon={icon} className="text-xs" />
      {children}
    </Link>
  );
}
