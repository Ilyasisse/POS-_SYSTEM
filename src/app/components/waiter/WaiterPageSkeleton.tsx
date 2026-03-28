export default function WaiterPageSkeleton() {
  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-blue-50 to-blue-100 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-blue-200/30">
          <div className="animate-pulse rounded-xl bg-[#4F7CFF] px-4 py-3 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-3">
                <div className="h-3 w-20 rounded-full bg-blue-300/70" />
                <div className="h-7 w-40 rounded-full bg-blue-200/80" />
                <div className="space-y-2 pt-1">
                  <div className="h-3 w-24 rounded-full bg-blue-300/70" />
                  <div className="h-4 w-32 rounded-full bg-blue-100/90" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-28 rounded-full bg-green-400/80" />
                <div className="h-10 w-24 rounded-xl bg-blue-200/80" />
              </div>
            </div>
          </div>

          <div className="animate-pulse rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <div className="mb-3 h-4 w-28 rounded-full bg-blue-200" />
            <div className="flex flex-wrap gap-2">
              <div className="h-11 w-28 rounded-lg bg-white ring-1 ring-blue-100" />
              <div className="h-11 w-32 rounded-lg bg-white ring-1 ring-blue-100" />
              <div className="h-11 w-24 rounded-lg bg-white ring-1 ring-blue-100" />
              <div className="h-11 w-36 rounded-lg bg-white ring-1 ring-blue-100" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 animate-pulse">
            <div className="h-11 w-24 rounded-lg bg-blue-600" />
            <div className="h-11 w-28 rounded-lg bg-white ring-1 ring-blue-100" />
            <div className="h-11 w-20 rounded-lg bg-white ring-1 ring-blue-100" />
            <div className="h-11 w-32 rounded-lg bg-white ring-1 ring-blue-100" />
            <div className="h-11 w-24 rounded-lg bg-white ring-1 ring-blue-100" />
          </div>

          <div className="h-12 animate-pulse rounded-xl border border-slate-200 bg-white" />

          <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse min-h-28 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm"
              >
                <div className="h-4 w-3/4 rounded-full bg-slate-200" />
                <div className="mt-2 h-4 w-1/2 rounded-full bg-slate-100" />
                <div className="mt-6 h-5 w-20 rounded-full bg-green-100" />
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-300/40">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="h-7 w-36 rounded-full bg-slate-200" />
              <div className="h-6 w-20 rounded-full bg-green-100" />
            </div>

            <div className="space-y-2 overflow-y-auto pr-1">
              <div className="rounded-lg bg-slate-100 p-3">
                <div className="h-4 w-32 rounded-full bg-slate-200" />
              </div>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="h-4 w-2/3 rounded-full bg-slate-200" />
                  <div className="mt-2 h-3 w-1/3 rounded-full bg-slate-100" />
                  <div className="mt-3 flex justify-between">
                    <div className="h-8 w-20 rounded-lg bg-slate-100" />
                    <div className="h-8 w-16 rounded-lg bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-1 h-4 w-28 rounded-full bg-slate-200" />
              <div className="h-24 rounded-lg border border-slate-200 bg-white" />
            </div>

            <div className="space-y-2">
              <div className="h-4 w-32 rounded-full bg-slate-200" />
              <div className="flex gap-2">
                <div className="h-10 flex-1 rounded-lg bg-slate-100" />
                <div className="h-10 flex-1 rounded-lg bg-slate-100" />
                <div className="h-10 flex-1 rounded-lg bg-slate-100" />
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 p-4">
              <div className="flex justify-between">
                <div className="h-5 w-20 rounded-full bg-slate-700" />
                <div className="h-5 w-24 rounded-full bg-green-300/60" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="h-11 rounded-lg bg-slate-100" />
              <div className="h-11 rounded-lg bg-green-200" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
