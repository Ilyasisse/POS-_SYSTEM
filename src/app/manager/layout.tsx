import type { ReactNode } from "react";
import Link from "next/link";
import SignOutButton from "@/app/components/SignOutButton";
import { requireRole } from "@/lib/auth/requireRole";

type ManagerLayoutProps = {
  children: ReactNode;
};

export default async function ManagerLayout({ children }: ManagerLayoutProps) {
  const currentUser = await requireRole(["MANAGER", "ADMIN"]);

  return (
    <div>
      <div className="border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Manager Session
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {currentUser.fullName}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/manager"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Dashboard
            </Link>
            <Link
              href="/manager/waiter-orders"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Waiter orders
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
