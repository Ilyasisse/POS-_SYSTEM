import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function WaiterPageSkeleton() {
  return (
    <main className="min-h-screen bg-muted/35 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Card className="gap-3 p-5">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </Card>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="gap-3 p-4">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
