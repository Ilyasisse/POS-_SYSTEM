import type { ReactNode } from "react";

type AdminThProps = {
  children: ReactNode;
};

/**
 * Renders a shared admin table header cell.
 *
 * @param props - Admin table header cell options.
 * @param props.children - The header cell content.
 * @returns The rendered admin table header cell.
 *
 * @remarks Used by the tables, staff, modifier groups, inventory, modifiers, orders,
 * products, and categories admin pages.
 */
export function AdminTh({ children }: AdminThProps) {
  return (
    <th className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-xs font-black text-slate-500">
      {children}
    </th>
  );
}
