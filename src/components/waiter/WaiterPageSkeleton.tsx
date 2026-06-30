import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function WaiterPageSkeleton() {
  return (
    <main className="min-h-screen bg-muted/35 p-4 sm:p-6">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="gap-4 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        </Card>
        <Card className="gap-3 p-4">
          <Skeleton className="h-8 w-40" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </Card>
      </div>
    </main>
  );
}
