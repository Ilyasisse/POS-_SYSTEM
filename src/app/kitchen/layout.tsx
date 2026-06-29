import type { ReactNode } from "react";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-permission";

type SegmentLayoutProps = {
  children: ReactNode;
};

/**
 * Passes route children through for this planned layout segment.
 *
 * @param props - Layout props.
 * @param props.children - Nested route content.
 * @returns The nested route content.
 *
 * @remarks Replace this with a custom layout when the segment needs shared UI.
 */
export default async function SegmentLayout({ children }: SegmentLayoutProps) {
  await requirePermission(PERMISSIONS.KITCHEN_TICKET_VIEW);
  return <>{children}</>;
}
