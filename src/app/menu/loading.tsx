const bodyFont = '"Avenir Next", "Segoe UI", sans-serif';
const displayFont =
  '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif';

export default function MenuLoading() {
  return (
    <main
      className="min-h-screen bg-[linear-gradient(135deg,#120d09_0%,#20140f_48%,#0f1017_100%)] px-4 py-6 text-stone-50 sm:px-6 lg:px-8 lg:py-8"
      style={{ fontFamily: bodyFont }}
    >
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[36px] border border-white/10 bg-white/8 p-6 backdrop-blur-xl sm:p-8">
          <div className="h-5 w-32 animate-pulse rounded-full bg-white/10" />
          <div
            className="mt-6 h-24 max-w-4xl animate-pulse rounded-[28px] bg-white/10"
            style={{ fontFamily: displayFont }}
          />
          <div className="mt-5 h-5 max-w-2xl animate-pulse rounded-full bg-white/10" />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-[28px] border border-white/10 bg-white/8"
              />
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[30px] border border-white/10 bg-white/8 p-5 backdrop-blur-xl"
            >
              <div className="h-56 animate-pulse rounded-[24px] bg-white/10" />
              <div className="mt-5 h-5 w-40 animate-pulse rounded-full bg-white/10" />
              <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/10" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <div
              key={sectionIndex}
              className="rounded-[34px] border border-white/10 bg-white/8 p-5 backdrop-blur-xl sm:p-7"
            >
              <div className="h-6 w-40 animate-pulse rounded-full bg-white/10" />
              <div className="mt-4 h-12 w-72 animate-pulse rounded-[20px] bg-white/10" />
              <div className="mt-7 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, cardIndex) => (
                  <div
                    key={cardIndex}
                    className="rounded-[30px] border border-white/10 bg-white/8 p-4"
                  >
                    <div className="h-56 animate-pulse rounded-[24px] bg-white/10" />
                    <div className="mt-5 h-5 w-28 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/10" />
                    <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
