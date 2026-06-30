import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export default function DashboardCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="gap-0 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {(() => {
            const Icon = icon;
            return <Icon className="size-5 text-primary" />;
          })()}
          <h2 className="truncate text-base font-semibold sm:text-lg">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
