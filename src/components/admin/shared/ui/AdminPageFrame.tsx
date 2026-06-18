import type { ReactNode } from "react";

type AdminPageFrameProps = {
 
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
};

/**
 * Wraps an admin page with the shared title, description, optional action, and content spacing.
 *
 * @param props - Admin page frame options.
 * @param props.title - The page title shown in the header.
 * @param props.description - The short helper text shown under the title.
 * @param props.children - The main admin page content.
 * @param props.action - Optional action content shown on the right side of the header.
 * @returns The rendered admin page frame.
 *
 * @remarks Used by the inventory, orders, profile, modifiers, tables, staff, products,
 * categories, modifier groups, reports, and settings admin pages.
 */
export function AdminPageFrame({
  title,
  description,
  children,
  action,
}: AdminPageFrameProps) {
  return (
    <main className="px-3 py-5 text-slate-950 sm:px-5 lg:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-448 space-y-5 pb-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            
            <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {description}
            </p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
        {children}
      </div>
    </main>
  );
}
