"use client";

import {
  CustomerLanguageSelect,
  useCustomerTranslations,
} from "@/components/customer/i18n/CustomerLanguageProvider";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { displayFont } from "../customer-order-styles";
import { formatCurrency } from "../customer-order-utils";
import { ModeToggle } from "@/components/mode-toggle";

type CustomerOrderHeaderProps = {
  cartSubtotal: number;
  cartCount: number;
  onReset: () => void;
  onOpenCart: () => void;
  title?: string;
  subtitle?: string;
  resetLabel?: string;
  cartLabel?: string;
  hideCartOnDesktop?: boolean;
};

export default function CustomerOrderHeader({
  cartSubtotal,
  cartCount,
  onReset,
  onOpenCart,
  title = "Mash Allah Cafe",
  subtitle,
  resetLabel,
  cartLabel,
  hideCartOnDesktop = false,
}: CustomerOrderHeaderProps) {
  const t = useCustomerTranslations();
  return (
    <header
      data-aos="fade-down"
      className="border-border bg-card/88 sticky top-2 z-30 rounded-[1.25rem] border px-4 py-4 shadow-[0_20px_60px_rgba(44,28,17,0.14)] backdrop-blur-xl sm:top-4 sm:rounded-3xl sm:px-5 sm:py-5"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-card flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 p-1.5 shadow-sm sm:h-14 sm:w-14 sm:rounded-[1.25rem] dark:border-amber-800/70">
            <Image
              src="/newer_logo.png"
              alt="Mash Allah Cafe"
              width={56}
              height={56}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1
              className="text-foreground mt-1 text-xl sm:text-3xl"
              style={{ fontFamily: displayFont }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="text-muted-foreground mt-1 text-sm font-medium">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-3 lg:w-auto">
          <CustomerLanguageSelect />
          <ModeToggle
            labels={{
              changeTheme: t("changeTheme"),
              light: t("lightTheme"),
              dark: t("darkTheme"),
              system: t("systemTheme"),
            }}
          />
          <Button
            variant="outline"
            type="button"
            onClick={onReset}
            className="border-border bg-card text-foreground hover:bg-muted rounded-full border px-5 py-3 text-sm font-semibold transition"
          >
            {resetLabel ?? t("startOver")}
          </Button>

          <Button
            type="button"
            onClick={onOpenCart}
            className={`bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5 py-3 text-sm font-semibold transition ${hideCartOnDesktop ? "lg:hidden" : ""}`}
          >
            {cartLabel ?? t("cart")} {formatCurrency(cartSubtotal)} ({cartCount})
          </Button>
        </div>
      </div>
    </header>
  );
}
