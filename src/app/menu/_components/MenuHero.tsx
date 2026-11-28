import Image from "next/image";
import Link from "next/link";

export default function MenuHero({ heroImage }: { heroImage: string }) {
  return (
    <section className="dark:bg-background relative isolate min-h-140 overflow-hidden bg-[#120906] pt-28 text-white sm:min-h-155 sm:pt-32 lg:min-h-170 xl:min-h-180">
      <div className="absolute inset-0 -z-10">
        <Image
          src={heroImage}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="h-full w-full object-cover object-[57%_center] sm:object-center lg:object-[50%_center]"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(14,7,4,0.88)_0%,rgba(14,7,4,0.72)_48%,rgba(14,7,4,0.52)_100%)] sm:bg-[linear-gradient(90deg,rgba(14,7,4,0.92)_0%,rgba(14,7,4,0.76)_44%,rgba(14,7,4,0.40)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(231,177,110,0.22),transparent_34%)]" />

      <div className="relative mx-auto max-w-7xl px-4 pt-6 pb-20 sm:px-6 lg:px-8 lg:pb-24">
        <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:pt-20">
          <div className="max-w-3xl">
            <h1
              className="mt-0 text-5xl leading-none text-[#fff7ef] sm:text-6xl lg:text-7xl"
              style={{
                fontFamily: '"Iowan Old Style", "Palatino Linotype", serif',
              }}
            >
              Our Menu
            </h1>
            <p className="mt-4 max-w-2xl text-[14px] leading-7 text-white/80 sm:text-xl">
              Fresh coffee, tasty food, and refreshing drinks made for you.
            </p>
            <p className="mt-4 max-w-2xl text-[12px] leading-7 text-white/60 sm:text-base">
              Take a look at our menu, find your favorites, and order when you&apos;re ready.
            </p>

            <div className="mt-8 flex flex-wrap gap-4 md:flex-nowrap">
              <Link
                prefetch={false}
                href="#menu-grid"
                className="text-md w-full rounded-full bg-white px-6 py-3.5 text-center font-semibold tracking-widest text-[#24140c] transition hover:bg-[#f8efe4] sm:max-w-[60%] md:w-auto md:max-w-none md:min-w-48"
              >
                Explore Menu
              </Link>
              <Link
                prefetch={false}
                href="/customer"
                className="w-full rounded-full border border-white/16 bg-white/6 px-6 py-3.5 text-center text-xl font-semibold tracking-widest text-white transition hover:bg-white/12 sm:max-w-[60%] md:w-auto md:max-w-none md:min-w-48"
              >
                Order Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
