export default function CashierPageSkeleton() {
  return (
    <main className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-52 rounded-full bg-slate-200" />
          <div className="h-5 w-40 rounded-full bg-slate-100" />
          <div className="h-4 w-48 rounded-full bg-slate-100" />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-10 w-40 animate-pulse rounded-xl bg-blue-200" />
          <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>

      <div className="mb-6 animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-11 flex-1 rounded-xl bg-slate-100" />
          <div className="flex gap-2">
            <div className="h-11 w-20 rounded-xl bg-blue-200" />
            <div className="h-11 w-20 rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="mb-6 animate-pulse rounded-2xl border border-red-100 bg-red-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="h-5 w-28 rounded-full bg-red-200" />
            <div className="h-4 w-80 max-w-full rounded-full bg-red-100" />
          </div>
          <div className="h-10 w-56 rounded-xl bg-red-200" />
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            <div className="h-6 w-52 rounded-full bg-slate-200" />
            <div className="h-4 w-72 max-w-full rounded-full bg-slate-100" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr_auto] md:items-end">
            <div>
              <div className="mb-2 h-4 w-16 rounded-full bg-slate-200" />
              <div className="h-11 rounded-xl bg-slate-100" />
            </div>
            <div className="h-4 w-40 self-end rounded-full bg-slate-100 md:pb-3" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="h-4 w-28 rounded-full bg-slate-200" />
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="h-6 w-24 rounded-full bg-slate-200" />
                <div className="mt-2 h-3 w-full rounded-full bg-slate-100" />
                <div className="mt-2 h-3 w-2/3 rounded-full bg-slate-100" />
              </div>
              <div className="mt-4 h-10 w-32 rounded-xl bg-blue-200" />
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="h-4 w-28 rounded-full bg-slate-200" />
              <div className="mt-3 h-11 rounded-xl bg-slate-100" />
              <div className="mt-4 h-10 w-32 rounded-xl bg-slate-900/10" />
            </div>
          </div>
        </div>

        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-6 w-48 rounded-full bg-slate-200" />
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="h-3 w-14 rounded-full bg-slate-200" />
              <div className="mt-2 h-5 w-32 rounded-full bg-slate-100" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-xl bg-slate-50 p-3">
                  <div className="h-3 w-16 rounded-full bg-slate-200" />
                  <div className="mt-2 h-5 w-20 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>

            <div className="h-4 w-44 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="h-4 w-28 rounded-full bg-slate-200" />
            <div className="mt-3 h-8 w-20 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="animate-pulse">
          <div className="grid grid-cols-6 gap-4 bg-slate-50 px-4 py-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-4 rounded-full bg-slate-200" />
            ))}
          </div>

          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-6 gap-4 border-t border-slate-100 px-4 py-4"
            >
              {Array.from({ length: 6 }).map((_, columnIndex) => (
                <div
                  key={columnIndex}
                  className="h-4 rounded-full bg-slate-100"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
