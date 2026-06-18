import type { ReactNode } from "react";

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
export default function SegmentLayout({ children }: SegmentLayoutProps) {
  return <>{children}</>;
}