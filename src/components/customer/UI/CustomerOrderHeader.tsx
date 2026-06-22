import Image from "next/image";
import { displayFont } from "../CustomerOrderPage";
import { formatCurrency } from "../customer-order-utils";

type CustomerOrderHeaderProps = {
  cartSubtotal: number;
  cartCount: number;
  onReset: () => void;
  onOpenCart: () => void;
};

export default function CustomerOrderHeader({
  cartSubtotal,
  cartCount,
  onReset,
  onOpenCart,
}: CustomerOrderHeaderProps) {
  return (
    <header
      data-aos="fade-down"
      className="sticky top-2 z-30 rounded-[1.25rem] border border-white/80 bg-white/88 px-4 py-4 shadow-[0_20px_60px_rgba(44,28,17,0.14)] backdrop-blur-xl sm:top-4 sm:rounded-3xl sm:px-5 sm:py-5"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/70 bg-white p-1.5 shadow-sm sm:h-14 sm:w-14 sm:rounded-[1.25rem]">
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
              className="mt-1 text-xl text-stone-950 sm:text-3xl"
              style={{ fontFamily: displayFont }}
            >
              Mash Allah Cafe
            </h1>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
          >
            Start Over
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Cart {formatCurrency(cartSubtotal)} ({cartCount})
          </button>
        </div>
      </div>
    </header>
  );
}
