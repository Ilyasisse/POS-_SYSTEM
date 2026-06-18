import type { ReactNode } from "react";

type AdminTdProps = {
  children: ReactNode;
  className?: string;
  colSpan?: number;
};

/**
 * Renders a shared admin table body cell with optional class names and column span.
 *
 * @param props - Admin table body cell options.
 * @param props.children - The body cell content.
 * @param props.className - Optional extra Tailwind classes added to the cell.
 * @param props.colSpan - Optional number of columns the cell should span.
 * @returns The rendered admin table body cell.
 *
 * @remarks Used by the categories, inventory, modifiers, tables, orders, staff,
 * products, and modifier groups admin pages.
 */
export function AdminTd({ children, className = "", colSpan }: AdminTdProps) {
  return (
    <td
      colSpan={colSpan}
      className={`whitespace-nowrap px-4 py-3 text-slate-600 ${className}`}
    >
      {children}
    </td>
  );
}
