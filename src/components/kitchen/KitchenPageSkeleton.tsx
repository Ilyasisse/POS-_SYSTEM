export default function KitchenPageSkeleton() {
  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-6 text-slate-100 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="animate-pulse rounded-3xl border border-slate-700 bg-slate-800/80 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded-full bg-slate-600" />
              <div className="h-8 w-56 rounded-full bg-slate-600" />
              <div className="h-4 w-40 rounded-full bg-slate-700" />
            </div>
            <div className="flex gap-3">
              <div className="h-12 w-28 rounded-2xl bg-emerald-400/30" />
              <div className="h-12 w-24 rounded-2xl bg-slate-700" />
            </div>
          </div>
        </div>

        <div className="h-12 animate-pulse rounded-2xl bg-slate-800/80" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-3xl border border-slate-700 bg-slate-800/80 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-4 w-24 rounded-full bg-slate-600" />
                  <div className="h-6 w-36 rounded-full bg-slate-500" />
                </div>
                <div className="h-8 w-16 rounded-full bg-amber-400/30" />
              </div>

              <div className="mt-5 space-y-3">
                <div className="h-4 w-full rounded-full bg-slate-700" />
                <div className="h-4 w-5/6 rounded-full bg-slate-700" />
                <div className="h-4 w-2/3 rounded-full bg-slate-700" />
              </div>

              <div className="mt-5 grid gap-2">
                <div className="h-10 rounded-2xl bg-slate-700" />
                <div className="h-10 rounded-2xl bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
