import { Skeleton } from "@/components/ui/skeleton";

export default function MenuLoading() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-80 w-full" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 shrink-0" />
          ))}
        </div>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-80 w-full" />
          ))}
        </section>
      </div>
    </main>
  );
}
