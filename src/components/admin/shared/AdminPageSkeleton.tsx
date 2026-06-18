import type { ReactNode } from "react";

type AdminPageSkeletonProps = {
  variant?: "dashboard" | "page";
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-slate-200 ${className}`} />;
}

function SkeletonCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 sm:p-5">
      {children}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-8 w-full max-w-sm" />
          <SkeletonBlock className="mt-3 h-4 w-full max-w-lg bg-slate-100" />
        </div>
        <div className="h-18 w-full animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm xl:w-72" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index}>
            <div className="flex items-center gap-4">
              <div className="size-14 animate-pulse rounded-2xl bg-slate-100" />
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-4 w-28 bg-slate-100" />
                <SkeletonBlock className="mt-3 h-8 w-16" />
                <SkeletonBlock className="mt-2 h-3 w-24 bg-slate-100" />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,2.2fr)_minmax(22rem,0.95fr)]">
        <SkeletonCard>
          <div className="mb-4 flex items-center justify-between">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-10 w-28 bg-slate-100" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="min-h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard>
          <SkeletonBlock className="h-5 w-48" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="size-11 animate-pulse rounded-xl bg-slate-100" />
                <div className="min-w-0 flex-1">
                  <SkeletonBlock className="h-4 w-36" />
                  <SkeletonBlock className="mt-2 h-3 w-44 bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)] 2xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.8fr)_minmax(22rem,0.8fr)]">
        <SkeletonCard>
          <div className="mb-4 flex items-center justify-between">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-10 w-24 bg-slate-100" />
          </div>
          <div className="h-52 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        </SkeletonCard>

        {Array.from({ length: 2 }).map((_, cardIndex) => (
          <SkeletonCard key={cardIndex}>
            <SkeletonBlock className="h-5 w-40" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 5 }).map((__, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-3">
                  <div className="size-9 animate-pulse rounded-lg bg-slate-100" />
                  <SkeletonBlock className="h-4 min-w-0 flex-1 bg-slate-100" />
                  <SkeletonBlock className="h-3 w-14 bg-slate-100" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </section>
    </>
  );
}

function PageSkeleton() {
  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <SkeletonBlock className="h-3 w-36 bg-slate-100" />
        <SkeletonBlock className="mt-4 h-8 w-full max-w-xs" />
        <SkeletonBlock className="mt-3 h-4 w-full max-w-2xl bg-slate-100" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index}>
            <SkeletonBlock className="h-4 w-28 bg-slate-100" />
            <SkeletonBlock className="mt-4 h-9 w-20" />
            <SkeletonBlock className="mt-3 h-3 w-32 bg-slate-100" />
          </SkeletonCard>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-10 w-full max-w-40 bg-slate-100" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_auto]"
            >
              <SkeletonBlock className="h-4 w-full bg-slate-200" />
              <SkeletonBlock className="h-4 w-28 bg-slate-200" />
              <SkeletonBlock className="h-4 w-24 bg-slate-200" />
              <SkeletonBlock className="h-4 w-20 bg-slate-200" />
              <SkeletonBlock className="h-8 w-20 rounded-lg bg-slate-200" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default function AdminPageSkeleton({
  variant = "dashboard",
}: AdminPageSkeletonProps) {
  return (
    <main className="px-3 py-5 text-slate-950 sm:px-5 lg:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[112rem] space-y-5 pb-10">
        {variant === "dashboard" ? <DashboardSkeleton /> : <PageSkeleton />}
      </div>
    </main>
  );
}
