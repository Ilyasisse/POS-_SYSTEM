import { Skeleton } from "@/components/ui/skeleton";

export default function MenuLoading() {
  return (
    <main className="dark min-h-screen bg-[#120d09] p-4 text-stone-50 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <Skeleton className="h-20 w-full bg-white/10" />
        <Skeleton className="h-80 w-full bg-white/10" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 shrink-0 bg-white/10" />
          ))}
        </div>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-80 w-full bg-white/10" />
          ))}
        </section>
      </div>
    </main>
  );
}
