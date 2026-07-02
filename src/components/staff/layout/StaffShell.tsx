import type { ReactNode } from "react";
import type { Station, UserRole } from "@prisma/client";
import { cookies } from "next/headers";

import type { Permission } from "@/lib/auth/permissions";
import type { StaffNavCounts, StaffNavigationScope } from "./staff-navigation";
import StaffShellClient from "./StaffShellClient";

export type StaffShellCurrentUser = {
  fullName: string;
  role: UserRole;
  station: Station | null;
  permissions: Permission[];
};

export type StaffShellProps = {
  children: ReactNode;
  currentUser: StaffShellCurrentUser;
  counts?: StaffNavCounts;
  navigationScope?: StaffNavigationScope;
  workspaceLabel: string;
  workspaceDescription?: string;
  tone?: "light" | "dark";
  searchSlot?: ReactNode;
  headerActions?: ReactNode;
};

const SIDEBAR_COOKIE_NAME = "sidebar_state";

function getDefaultSidebarOpen(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  return cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false";
}

export default async function StaffShell(props: StaffShellProps) {
  const cookieStore = await cookies();

  return (
    <StaffShellClient
      {...props}
      defaultSidebarOpen={getDefaultSidebarOpen(cookieStore)}
    />
  );
}
