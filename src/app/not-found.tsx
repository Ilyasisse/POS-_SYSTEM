import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7efe6] px-4 py-10 text-[#2f180d] sm:px-6">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#fff8ef_0%,#f2dfc7_48%,#e8c18f_100%)]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(47,24,13,0.16),transparent)]" />

      <section className="relative z-10 w-full max-w-lg rounded-[30px] border border-white/70 bg-white/90 p-6 text-center shadow-[0_26px_80px_rgba(65,39,21,0.16)] backdrop-blur sm:p-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#f3dcc1] shadow-[0_18px_40px_rgba(176,123,69,0.18)]">
          <Image
            src="/newer_logo.png"
            alt="Mash Allah Cafe"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority
          />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#b07b45]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[#2f180d]">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#725c4c]">
          This page is not available. Head back to the menu, customer login, or
          staff access.
        </p>

       

        <Link
          href="/"
          className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border border-[#e4d2bf] bg-[#fff8f0] px-5 py-3 text-sm font-semibold text-[#3a2418] transition hover:-translate-y-0.5 hover:border-[#d09a59] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#d09a59] focus:ring-offset-2"
        >
          Head Back
        </Link>
      </section>
    </main>
  );
}
