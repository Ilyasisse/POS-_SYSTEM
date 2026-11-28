"use client";

import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";
import { Button } from "@/components/ui/button";
type BackToTopButtonProps = {
  show: boolean;
  onClick: () => void;
};

export default function BackToTopButton({ show, onClick }: BackToTopButtonProps) {
  const t = useCustomerTranslations();
  if (!show) {
    return null;
  }

  return (
    <Button
      type="button"
      aria-label={t("backToTop")}
      onClick={onClick}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring focus:ring-offset-background fixed right-5 bottom-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/70 shadow-[0_18px_45px_rgba(44,28,17,0.28)] transition hover:-translate-y-0.5 focus:ring-2 focus:ring-offset-2 focus:outline-none sm:right-7 sm:bottom-7 sm:h-14 sm:w-14"
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
