import type { ReactNode } from "react";
import { AdminCard } from "./AdminCard";

type AdminTableShellProps = {
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Wraps admin tables in the shared card, horizontal scroll container, and optional footer.
 *
 * @param props - Admin table shell options.
 * @param props.children - The table or table-like content to wrap.
 * @param props.footer - Optional footer content shown below the scroll area.
 * @returns The rendered admin table shell.
 *
 * @remarks Used by the tables, staff, inventory, modifier groups, categories, orders,
 * modifiers, and products admin pages.
 */
export function AdminTableShell({ children, footer }: AdminTableShellProps) {
  return (
    <AdminCard className="overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
      {footer ? <div className="border-t border-slate-100 px-4 py-3">{footer}</div> : null}
    </AdminCard>
  );
}
