import { Button } from "@/components/ui/button";
import Image from "next/image";
import { displayFont } from "../customer-order-styles";
import { formatCurrency } from "../customer-order-utils";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";

type CustomerOrderHeaderProps = {
  cartSubtotal: number;
  cartCount: number;
  onReset: () => void;
  onOpenCart: () => void;
  title?: string;
  subtitle?: string;
  resetLabel?: string;
  cartLabel?: string;
  historyHref?: string;
};

export default function CustomerOrderHeader({
  cartSubtotal,
  cartCount,
  onReset,
  onOpenCart,
  title = "Mash Allah Cafe",
  subtitle,
  resetLabel = "Start Over",
  cartLabel = "Cart",
  historyHref,
}: CustomerOrderHeaderProps) {
  return (
    <header
      data-aos="fade-down"
      className="sticky top-2 z-30 rounded-[1.25rem] border border-white/80 bg-card/88 px-4 py-4 shadow-[0_20px_60px_rgba(44,28,17,0.14)] backdrop-blur-xl sm:top-4 sm:rounded-3xl sm:px-5 sm:py-5"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/70 bg-card p-1.5 shadow-sm sm:h-14 sm:w-14 sm:rounded-[1.25rem]">
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
              className="mt-1 text-xl text-foreground sm:text-3xl"
              style={{ fontFamily: displayFont }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-3 lg:w-auto">
          <ModeToggle />
          {historyHref ? (
            <Button asChild variant="outline" className="rounded-full">
              <Link href={historyHref}>My orders</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={onReset}
            className="rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            {resetLabel}
          </Button>

          <Button
            type="button"
            onClick={onOpenCart}
            className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            {cartLabel} {formatCurrency(cartSubtotal)} ({cartCount})
          </Button>
        </div>
      </div>
    </header>
  );
}
