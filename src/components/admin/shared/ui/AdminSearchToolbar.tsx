import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

type AdminSearchToolbarProps = {
  placeholder: string;
  defaultValue?: string;
  children?: ReactNode;
};

/**
 * Renders the shared search form row with optional filter controls.
 *
 * @param props - Admin search toolbar options.
 * @param props.placeholder - The search input placeholder and screen-reader label.
 * @param props.defaultValue - Optional initial value for the search input.
 * @param props.children - Optional filter controls rendered beside the search input.
 * @returns The rendered admin search toolbar form.
 *
 * @remarks Used by the inventory, tables, orders, categories, staff, modifier groups,
 * modifiers, and products admin pages.
 */
export function AdminSearchToolbar({
  placeholder,
  defaultValue,
  children,
}: AdminSearchToolbarProps) {
  return (
    <form className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
        />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
      </label>
      {children}
    </form>
  );
}
