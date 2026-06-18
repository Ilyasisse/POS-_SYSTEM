"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faTimes } from "@fortawesome/free-solid-svg-icons";
import type { AdminNavCounts, AdminShellProps } from "./AdminShell";

type AdminMobileSidebarProps = {
  currentUser: AdminShellProps["currentUser"];
  counts: AdminNavCounts;
  pathname: string;
  SidebarContent: React.ComponentType<{
    currentUser: AdminShellProps["currentUser"];
    counts: AdminNavCounts;
    pathname: string;
    onNavigate?: () => void;
  }>;
};

export default function AdminMobileSidebar({
  currentUser,
  counts,
  pathname,
  SidebarContent,
}: AdminMobileSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <FontAwesomeIcon icon={faBars} />
      </button>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close admin navigation"
            onClick={() => setSidebarOpen(false)}
          />

          <aside className="absolute inset-y-0 left-0 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-r-3xl bg-white shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
                aria-label="Close menu"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <SidebarContent
              currentUser={currentUser}
              counts={counts}
              pathname={pathname}
              onNavigate={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}