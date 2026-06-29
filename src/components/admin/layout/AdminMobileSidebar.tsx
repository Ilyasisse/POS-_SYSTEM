"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type {
  AdminShellProps,
  AdminSidebarContentProps,
} from "./AdminShell";
import type { AdminNavCounts } from "./admin-navigation";

type AdminMobileSidebarProps = {
  currentUser: AdminShellProps["currentUser"];
  counts: AdminNavCounts;
  pathname: string;
  SidebarContent: React.ComponentType<AdminSidebarContentProps>;
};

export default function AdminMobileSidebar({
  currentUser,
  counts,
  pathname,
  SidebarContent,
}: AdminMobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          aria-label="Open admin navigation"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Admin navigation</SheetTitle>
          <SheetDescription>Navigate the administration workspace.</SheetDescription>
        </SheetHeader>
        <SidebarContent
          currentUser={currentUser}
          counts={counts}
          pathname={pathname}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
