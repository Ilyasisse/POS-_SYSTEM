"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { CustomerLanguageSelect } from "@/components/customer/i18n/CustomerLanguageProvider";
import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export default function MenuChrome({ cafeName }: { cafeName: string }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const resetScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const onScroll = () => setShowBackToTop(window.scrollY > 620);
    resetScroll();
    window.addEventListener("pageshow", resetScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.history.scrollRestoration = previous;
      window.removeEventListener("pageshow", resetScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <>
      <MenuHeader
        cafeName={cafeName}
        mobileNavOpen={mobileNavOpen}
        onCloseMobileNav={() => setMobileNavOpen(false)}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
      />
      {showBackToTop && !mobileNavOpen ? (
        <BackToTopButton onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
      ) : null}
    </>
  );
}

function MenuHeader({
  cafeName,
  mobileNavOpen,
  onCloseMobileNav,
  onToggleMobileNav,
}: {
  cafeName: string;
  mobileNavOpen: boolean;
  onCloseMobileNav: () => void;
  onToggleMobileNav: () => void;
}) {
  const t = useCustomerTranslations();
  return (
    <div className="dark:bg-background/90 fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#120906]/74 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="py-3">
          <div className="flex items-center justify-between gap-2 rounded-[28px] border border-white/10 bg-white/6 px-4 py-4 md:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[18px]">
                <Image
                  src="/newer_logo.png"
                  alt={cafeName}
                  width={100}
                  height={100}
                  sizes="100px"
                  className="h-25 w-25 max-w-none shrink-0 object-contain"
                />
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm tracking-[0.34em] text-[#f3d9b9] uppercase">
                  {cafeName}
                </p>
                <p className="text-sm text-white/70"></p>
              </div>
            </div>

            <nav className="hidden items-center gap-2 text-sm font-medium text-white/78 lg:flex">
              <Link
                prefetch={false}
                href="/"
                className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
              >
                {t("home")}
              </Link>
              <Link
                prefetch={false}
                href="/menu"
                className="rounded-full border border-[#d7aa6a]/60 bg-[#d7aa6a]/12 px-4 py-2 text-white"
              >
                {t("menu")}
              </Link>

              <Link
                prefetch={false}
                href="#contact"
                className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
              >
                {t("contact")}
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              <CustomerLanguageSelect />
              <ModeToggle
                labels={{
                  changeTheme: t("changeTheme"),
                  light: t("lightTheme"),
                  dark: t("darkTheme"),
                  system: t("systemTheme"),
                }}
              />
              <Link
                prefetch={false}
                href="/customer"
                className="hidden items-center justify-center rounded-full bg-[#d09a59] px-5 py-3 text-sm font-semibold text-[#231208] shadow-[0_14px_30px_rgba(208,154,89,0.25)] transition hover:bg-[#deab6d] lg:inline-flex"
              >
                {t("orderNow")}
              </Link>

              <Button
                type="button"
                onClick={onToggleMobileNav}
                aria-expanded={mobileNavOpen}
                aria-label={t("toggleNavigation")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/12 lg:hidden"
              >
                <span className="flex flex-col gap-1.5">
                  <span
                    className={`h-0.5 w-5 rounded-full bg-current transition ${mobileNavOpen ? "translate-y-2 rotate-45" : ""}`}
                  />
                  <span
                    className={`h-0.5 w-5 rounded-full bg-current transition ${mobileNavOpen ? "opacity-0" : ""}`}
                  />
                  <span
                    className={`h-0.5 w-5 rounded-full bg-current transition ${mobileNavOpen ? "-translate-y-2 -rotate-45" : ""}`}
                  />
                </span>
              </Button>
            </div>
          </div>

          {mobileNavOpen ? (
            <div className="dark:bg-popover/95 mt-3 rounded-[24px] border border-white/10 bg-[#1a0d08]/95 p-3 text-white shadow-[0_20px_50px_rgba(12,7,4,0.32)] lg:hidden">
              <div className="grid gap-2">
                <Link
                  prefetch={false}
                  href="/"
                  onClick={onCloseMobileNav}
                  className="rounded-[18px] px-4 py-3 text-sm font-medium transition"
                >
                  {t("home")}
                </Link>
                <Link
                  prefetch={false}
                  href="/menu"
                  onClick={onCloseMobileNav}
                  className="rounded-[18px] border border-[#d7aa6a]/30 bg-[#d7aa6a]/12 px-4 py-3 text-sm font-medium text-white"
                >
                  {t("menu")}
                </Link>

                <Link
                  prefetch={false}
                  href="#contact"
                  onClick={onCloseMobileNav}
                  className="rounded-[18px] px-4 py-3 text-sm font-medium transition"
                >
                  {t("contact")}
                </Link>
                <Link
                  prefetch={false}
                  href="/customer"
                  onClick={onCloseMobileNav}
                  className="mt-1 inline-flex items-center justify-center rounded-[18px] bg-[#d09a59] px-4 py-3 text-sm font-semibold text-[#231208] shadow-[0_14px_30px_rgba(208,154,89,0.25)] transition"
                >
                  {t("orderNow")}
                </Link>
              </div>
            </div>
          ) : null}
        </header>
      </div>
    </div>
  );
}

function BackToTopButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      aria-label="Back to top"
      onClick={onClick}
      className="dark:bg-background dark:hover:bg-accent fixed right-5 bottom-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[#f4dcc2]/50 bg-[#201108] text-[#fff6ec] shadow-[0_18px_45px_rgba(32,17,8,0.35)] transition hover:-translate-y-0.5 hover:bg-[#3d2417] focus:ring-2 focus:ring-[#d09a59] focus:ring-offset-2 focus:outline-none sm:right-7 sm:bottom-7 sm:h-14 sm:w-14"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </Button>
  );
}
