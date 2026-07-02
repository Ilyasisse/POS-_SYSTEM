import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type AdminPageSkeletonProps = {
  variant?: "dashboard" | "page";
};

function MetricSkeleton() {
  return (
    <Card className="gap-3 p-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-3 w-32" />
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-36" />
      </div>
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </Card>
  );
}

export default function AdminPageSkeleton({
  variant = "dashboard",
}: AdminPageSkeletonProps) {
  const metricCount = variant === "dashboard" ? 5 : 4;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-full max-w-sm" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: metricCount }).map((_, index) => (
          <MetricSkeleton key={index} />
        ))}
      </section>
      {variant === "dashboard" ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <TableSkeleton />
          <TableSkeleton />
        </section>
      ) : (
        <TableSkeleton />
      )}
    </div>
  );
}
