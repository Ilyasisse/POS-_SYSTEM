import type { ReactNode } from "react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

type ManagerLayoutProps = {
  children: ReactNode;
};

export default async function ManagerLayout({ children }: ManagerLayoutProps) {
  const currentUser = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);

  return (
    <div className="min-h-screen bg-muted/35">
      <div className="sticky top-0 z-30 border-b bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Manager Session
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {currentUser.fullName}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/manager">Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href="/manager/waiter-orders">Waiter orders</Link>
            </Button>
            <ModeToggle />
            <SignOutButton />
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
