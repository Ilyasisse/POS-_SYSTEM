"use client";

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
  usingSampleMenu: boolean;
  isSubmitting: boolean;
  submitMessage: string;
  submitError: string;
  statusMessage: string;
  socketStatus: string;
  lastOrderNumber: number | null;
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
  usingSampleMenu,
  isSubmitting,
  submitMessage,
  submitError,
  statusMessage,
  socketStatus,
  lastOrderNumber,
  onClose,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onOrderNoteChange,
  onChangeQuantity,
  onRemove,
  onClearCart,
  onCheckout,
}: CustomerCartSheetProps) {
  if (!open) {
    return null;
  }

  return (
        <div
          data-aos="fade"
          data-aos-duration="200"
          className="fixed inset-0 z-40 bg-stone-950/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <aside
            data-aos="fade-left"
            data-aos-duration="280"
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-white/10 bg-[#fffaf5] text-stone-900 shadow-[0_35px_120px_rgba(31,18,11,0.32)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-stone-200 bg-[linear-gradient(145deg,#20140f_0%,#4a281a_42%,#8c5b34_100%)] px-5 py-5 text-white sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-amber-200/90">
                    Your order
                  </p>
                  <h2
                    className="mt-3 text-4xl"
                    style={{
                      fontFamily:
                        '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
                    }}
                  >
                    Cart
                  </h2>
                  <p className="mt-3 text-sm text-stone-100/80">
                    Review items, enter order details, and send everything to
                    the POS checkout flow.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">
                    Cart total
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {formatCurrency(cartSubtotal)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-100/80">
                    Items
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {cartCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
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

              {statusMessage ? (
                <div className="rounded-[1.25rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
                  {statusMessage}
                </div>
              ) : null}

              {lastOrderNumber ? (
                <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Latest order number:{" "}
                  <span className="font-semibold">#{lastOrderNumber}</span>
                </div>
              ) : null}

              <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-[0_20px_45px_rgba(55,36,20,0.05)]">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                  Checkout details
                </p>
                <div className="mt-4 grid gap-3">
                  <input
                    value={customerName}
                    onChange={(event) => onCustomerNameChange(event.target.value)}
                    placeholder="Name for the order"
                    className="rounded-full border border-stone-200 bg-stone-50 px-5 py-3.5 text-sm outline-none focus:border-stone-400"
                  />
                  <input
                    value={customerPhone}
                    onChange={(event) => onCustomerPhoneChange(event.target.value)}
                    placeholder="Phone number (optional)"
                    className="rounded-full border border-stone-200 bg-stone-50 px-5 py-3.5 text-sm outline-none focus:border-stone-400"
                  />
                  <textarea
                    value={orderNote}
                    onChange={(event) => onOrderNoteChange(event.target.value)}
                    placeholder="Special requests or notes"
                    rows={4}
                    className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none focus:border-stone-400"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {cart.length === 0 ? (
                  <div className="flex min-h-[16rem] items-center justify-center rounded-[1.75rem] border border-dashed border-stone-300 bg-white/75 p-8 text-center text-sm text-stone-500">
                    Your cart is empty. Add items from the menu to continue.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.cartKey}
                      data-aos="fade-up"
                      className="rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-[0_20px_45px_rgba(55,36,20,0.05)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-stone-900">
                            {item.name}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-emerald-700">
                            {formatCurrency(Number(item.finalPrice ?? item.price))}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onRemove(item.cartKey)}
                          className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-700"
                        >
                          Remove
                        </button>
                      </div>

                      {item.selectedModifiers.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.selectedModifiers.map((modifier) => (
                            <span
                              key={`${item.cartKey}-${modifier.optionId}`}
                              className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700"
                            >
                              {modifier.groupName}: {modifier.optionName}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50">
                          <button
                            type="button"
                            onClick={() => onChangeQuantity(item.cartKey, -1)}
                            className="px-4 py-3 text-lg font-semibold text-stone-800"
                          >
                            -
                          </button>
                          <span className="min-w-10 text-center text-sm font-semibold text-stone-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onChangeQuantity(item.cartKey, 1)}
                            className="px-4 py-3 text-lg font-semibold text-stone-800"
                          >
                            +
                          </button>
                        </div>

                        <p className="text-sm font-semibold text-stone-900">
                          {formatCurrency(
                            Number(item.lineTotal ?? item.finalPrice ?? item.price),
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-stone-200 bg-white px-5 py-5 sm:px-6">
              {usingSampleMenu ? (
                <p className="mb-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Placeholder menu mode is active. Add real products before live
                  checkout can be enabled.
                </p>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-900">
                    {formatCurrency(cartSubtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-base font-semibold text-stone-950">
                  <span>Total</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={onCheckout}
                  disabled={isSubmitting || cart.length === 0}
                  className="rounded-full bg-stone-950 px-6 py-4 text-base font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {usingSampleMenu
                    ? "Checkout disabled in sample mode"
                    : isSubmitting
                      ? "Placing order..."
                      : "Checkout"}
                </button>

                <button
                  type="button"
                  onClick={onClearCart}
                  disabled={cart.length === 0 || isSubmitting}
                  className="rounded-full border border-stone-200 bg-stone-50 px-6 py-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear cart
                </button>
              </div>

              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-stone-500">
                Kitchen connection:{" "}
                <span className="font-semibold text-stone-800">{socketStatus}</span>
              </p>
            </div>
          </aside>
        </div>
  );
}
