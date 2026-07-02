import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CashierPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="gap-3 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
          </Card>
        ))}
      </section>
      <Card className="gap-3 p-5">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </Card>
    </div>
  );
}
