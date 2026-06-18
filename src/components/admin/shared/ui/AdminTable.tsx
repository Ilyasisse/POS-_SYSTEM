import type { ReactNode } from "react";

type AdminTableProps = {
  children: ReactNode;
};

/**
 * Renders the shared admin table element.
 *
 * @param props - Admin table options.
 * @param props.children - The table rows, header, and body content.
 * @returns The rendered admin table.
 *
 * @remarks Used by the tables, staff, modifier groups, products, orders, modifiers,
 * inventory, and categories admin pages.
 */
export function AdminTable({ children }: AdminTableProps) {
  return <table className="min-w-full text-left text-sm">{children}</table>;
}
