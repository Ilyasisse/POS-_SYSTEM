import { Skeleton } from "@/components/ui/skeleton";

export default function KitchenPageSkeleton() {
  return (
    <main className="dark min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Skeleton className="h-28 w-full bg-slate-800" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full bg-slate-800" />
          ))}
        </div>
      </div>
    </main>
  );
}
