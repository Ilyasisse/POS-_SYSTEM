import type { ReactNode } from "react";

type AdminSelectProps = {
  name: string;
  defaultValue?: string;
  children: ReactNode;
};

/**
 * Renders the shared select control used inside admin filters.
 *
 * @param props - Admin select options.
 * @param props.name - The select field name submitted with the form.
 * @param props.defaultValue - Optional initial selected value.
 * @param props.children - The option elements rendered inside the select.
 * @returns The rendered admin select control.
 *
 * @remarks Used by the inventory, modifiers, orders, categories, staff, products,
 * and modifier groups admin pages.
 */
export function AdminSelect({ name, defaultValue, children }: AdminSelectProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    >
      {children}
    </select>
  );
}
