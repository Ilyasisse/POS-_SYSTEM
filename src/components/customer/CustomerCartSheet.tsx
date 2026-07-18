"use client";

import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";

import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { CartLine } from "@/lib/types";
import { formatCurrency } from "./customer-order-utils";

type CustomerCartSheetProps = {
  open: boolean;
  cart: CartLine[];
  customerName: string;
  customerPhone: string;
  orderNote: string;
  cartSubtotal: number;
  cartCount: number;
  isSubmitting: boolean;
  submitMessage: string;
  submitError: string;
  onClose: () => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onOrderNoteChange: (value: string) => void;
  onChangeQuantity: (cartKey: string, delta: number) => void;
  onRemove: (cartKey: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
};

export default function CustomerCartSheet({
  open,
  cart,
  customerName,
  customerPhone,
  orderNote,
  cartSubtotal,
  cartCount,
  isSubmitting,
  submitMessage,
  submitError,
  onClose,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onOrderNoteChange,
  onChangeQuantity,
  onRemove,
  onClearCart,
  onCheckout,
}: CustomerCartSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full gap-0 overflow-hidden border-l border-white/10 bg-[#fffaf5] p-0 text-foreground dark:bg-card dark:text-foreground sm:max-w-xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            Review order details, quantities, and checkout information.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 w-full flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border bg-[linear-gradient(145deg,#20140f_0%,#4a281a_42%,#8c5b34_100%)] px-4 py-4 text-white sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200/90">
                  Your order
                </p>
                <h2
                  className="mt-3 text-3xl sm:text-4xl"
                  style={{
                    fontFamily:
                      '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
                  }}
                >
                  Cart
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  {cartCount} item{cartCount === 1 ? "" : "s"}
                </p>
              </div>

              <Button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full border border-white/15 bg-card/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-card/15"
              >
                Close
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {submitMessage ? (
              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {submitMessage}
              </div>
            ) : null}

            {submitError ? (
              <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {submitError}
              </div>
            ) : null}
            {cart.length === 0 ? (
              <div className="flex min-h-[16rem] items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-card/75 p-8 text-center text-sm text-muted-foreground">
                Your cart is empty. Add items from the menu to continue.
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-border bg-card p-4 shadow-[0_20px_45px_rgba(55,36,20,0.05)]">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Checkout details
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Input
                    aria-label="Name for the order"
                    value={customerName}
                    onChange={(event) =>
                      onCustomerNameChange(event.target.value)
                    }
                    placeholder="Name for the order"
                    className="rounded-full border border-border bg-muted/50 px-5 py-3.5 text-sm outline-none focus:border-stone-400"
                  />
                  <Input
                    aria-label="Phone number"
                    value={customerPhone}
                    onChange={(event) =>
                      onCustomerPhoneChange(event.target.value)
                    }
                    placeholder="Phone number (optional)"
                    className="rounded-full border border-border bg-muted/50 px-5 py-3.5 text-sm outline-none focus:border-stone-400"
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      aria-label="Special requests or notes"
                      value={orderNote}
                      onChange={(event) =>
                        onOrderNoteChange(event.target.value)
                      }
                      placeholder="Special requests or notes"
                      rows={4}
                      className="w-full rounded-[1.25rem] border border-border bg-muted/50 px-4 py-3 text-sm outline-none focus:border-stone-400"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.cartKey}
                      data-aos="fade-up"
                      className="rounded-[1.5rem] border border-border bg-card p-4 shadow-[0_20px_45px_rgba(55,36,20,0.05)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-foreground">
                            {item.name}
                          </p>

                          <p className="mt-1 text-sm font-semibold text-emerald-700">
                            {formatCurrency(
                              Number(item.finalPrice ?? item.price),
                            )}
                          </p>
                        </div>

                        <Button
                          type="button"
                          onClick={() => onRemove(item.cartKey)}
                          className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-foreground"
                        >
                          Remove
                        </Button>
                      </div>

                      {item.selectedModifiers?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.selectedModifiers.map((modifier) => (
                            <span
                              key={`${item.cartKey}-${modifier.optionId}`}
                              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                            >
                              {modifier.groupName}: {modifier.optionName}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-full border border-border bg-muted/50">
                          <Button
                            type="button"
                            aria-label={`Decrease quantity for ${item.name}`}
                            onClick={() => onChangeQuantity(item.cartKey, -1)}
                            className="px-4 py-3 text-lg font-semibold text-foreground"
                          >
                            -
                          </Button>

                          <span className="min-w-10 text-center text-sm font-semibold text-foreground">
                            {item.quantity}
                          </span>

                          <Button
                            type="button"
                            aria-label={`Increase quantity for ${item.name}`}
                            onClick={() => onChangeQuantity(item.cartKey, 1)}
                            className="px-4 py-3 text-lg font-semibold text-foreground"
                          >
                            +
                          </Button>
                        </div>

                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(
                            Number(
                              item.lineTotal ?? item.finalPrice ?? item.price,
                            ),
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(cartSubtotal)}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Button
                type="button"
                onClick={onCheckout}
                disabled={isSubmitting || cart.length === 0}
                className="rounded-full bg-stone-950 px-6 py-4 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {isSubmitting ? "Placing order..." : "Checkout"}
              </Button>

              <Button
                type="button"
                onClick={onClearCart}
                disabled={cart.length === 0 || isSubmitting}
                className="rounded-full border border-border bg-muted/50 px-6 py-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear cart
              </Button>
            </div>

          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
