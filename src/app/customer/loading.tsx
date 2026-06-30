import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerLoading() {
  return (
    <main className="min-h-screen bg-background p-3 sm:p-5 lg:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <Card className="flex-row items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-14 rounded-2xl" />
            <Skeleton className="h-8 w-52" />
          </div>
          <Skeleton className="h-10 w-32" />
        </Card>
        <Skeleton className="h-12 w-full" />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Card key={index} className="gap-3 p-4">
              <Skeleton className="aspect-[4/3] w-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-11 w-full" />
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
