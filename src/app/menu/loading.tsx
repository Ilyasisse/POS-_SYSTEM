const bodyFont = '"Avenir Next", "Segoe UI", sans-serif';

function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-white/12 ${className}`} />;
}

function MenuProductSkeleton() {
  return (
    <article className="overflow-hidden rounded-[24px] border border-white/10 bg-white/8 p-3 shadow-2xl shadow-black/20 backdrop-blur-xl sm:rounded-[30px] sm:p-4">
      <div className="aspect-[4/3] animate-pulse rounded-[20px] bg-white/12 sm:rounded-[24px]" />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Pulse className="h-5 w-3/4" />
          <Pulse className="mt-3 h-3 w-full bg-white/8" />
          <Pulse className="mt-2 h-3 w-4/5 bg-white/8" />
        </div>
        <Pulse className="h-8 w-16 rounded-xl" />
      </div>
    </article>
  );
}

export default function MenuLoading() {
  return (
    <main
      className="min-h-screen bg-[linear-gradient(135deg,#120d09_0%,#20140f_48%,#0f1017_100%)] px-3 py-4 text-stone-50 sm:px-5 sm:py-6 lg:px-8 lg:py-8"
      style={{ fontFamily: bodyFont }}
    >
      <div className="mx-auto w-full max-w-[92rem] space-y-5 sm:space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/8 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:rounded-[36px] sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-end">
            <div className="min-w-0">
              <Pulse className="h-4 w-32" />
              <Pulse className="mt-5 h-12 w-full max-w-3xl rounded-[24px] sm:h-16 lg:h-20" />
              <Pulse className="mt-4 h-4 w-full max-w-xl bg-white/8" />
              <Pulse className="mt-3 h-4 w-4/5 max-w-lg bg-white/8" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-[22px] border border-white/10 bg-white/10 sm:h-24"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="sticky top-3 z-10 rounded-[24px] border border-white/10 bg-black/20 p-3 backdrop-blur-xl">
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 7 }).map((_, index) => (
              <Pulse
                key={index}
                className="h-10 w-28 shrink-0 rounded-2xl bg-white/10 sm:w-32"
              />
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[26px] border border-white/10 bg-white/8 p-4 backdrop-blur-xl"
            >
              <div className="aspect-[16/10] animate-pulse rounded-[22px] bg-white/12" />
              <Pulse className="mt-4 h-5 w-40" />
              <Pulse className="mt-3 h-3 w-full bg-white/8" />
            </div>
          ))}
        </section>

        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <section
            key={sectionIndex}
            className="rounded-[28px] border border-white/10 bg-white/8 p-4 backdrop-blur-xl sm:rounded-[34px] sm:p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Pulse className="h-5 w-40" />
                <Pulse className="mt-3 h-10 w-64 rounded-[18px] bg-white/10" />
              </div>
              <Pulse className="h-10 w-full max-w-44 rounded-2xl bg-white/10" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((__, cardIndex) => (
                <MenuProductSkeleton key={cardIndex} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
