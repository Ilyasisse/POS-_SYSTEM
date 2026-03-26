export default function AdminPageSkeleton() {
  return (
    <main
      className="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-50 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-24">
        <header className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="h-3 w-32 rounded-full bg-slate-200" />
          <div className="mt-4 h-9 w-56 rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-full max-w-3xl rounded-full bg-slate-100" />
          <div className="mt-2 h-4 w-2/3 max-w-2xl rounded-full bg-slate-100" />
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-28 rounded-full bg-slate-200" />
                  <div className="mt-4 h-4 w-full rounded-full bg-slate-100" />
                  <div className="mt-2 h-4 w-5/6 rounded-full bg-slate-100" />
                  <div className="mt-2 h-4 w-2/3 rounded-full bg-slate-100" />
                </div>
                <div className="h-8 w-12 rounded-full bg-slate-900/10" />
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
