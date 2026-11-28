import { Skeleton } from "@/components/ui/skeleton";

export default function KitchenPageSkeleton() {
  return (
    <div className="min-h-screen bg-card p-4 text-foreground sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Skeleton className="h-28 w-full bg-card" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
