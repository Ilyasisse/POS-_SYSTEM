"use client";

import type { CartLine, ReceiptSnapshot, SocketStatus } from "@/lib/types";
import CartItemCard from "./CartItemCard";
import PaymentMethodSelector from "./PaymentMethodSelector";
import ReceiptPreview from "./ReceiptPreview";
import { translateSocketStatus } from "@/lib/ui-text";

type CurrentOrderPanelProps = {
  cart: CartLine[];
  socketStatus: SocketStatus;
  orderNote: string;
  onOrderNoteChange: (value: string) => void;
  paymentMethods: string[];
  selectedPayment: string;
  onSelectPayment: (method: string) => void;
  onChangeQuantity: (cartKey: string, delta: number) => void;
  total: number;
  onClear: () => void;
  onCompleteSale: () => void;
  isSubmitting: boolean;
  statusMessage: string;
  lastReceipt: ReceiptSnapshot | null;
};

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

export default function CurrentOrderPanel({
  cart,
  socketStatus,
  orderNote,
  onOrderNoteChange,
  paymentMethods,
  selectedPayment,
  onSelectPayment,
  onChangeQuantity,
  total,
  onClear,
  onCompleteSale,
  isSubmitting,
  statusMessage,
  lastReceipt,
}: CurrentOrderPanelProps) {
  const isDisabled = isSubmitting || cart.length === 0;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-300/40">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800">Dalabka hadda</h2>

        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${
            socketStatus === "connected"
              ? "bg-green-100 text-green-700"
              : socketStatus === "connecting"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {translateSocketStatus(socketStatus)}
        </span>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-500">
            Weli wax alaab ah lama darin.
          </p>
        ) : (
          cart.map((line) => (
            <CartItemCard
              key={line.cartKey}
              line={line}
              onChangeQuantity={onChangeQuantity}
            />
          ))
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-600">
          Qoraalka dalabka
        </span>
        <textarea
          value={orderNote}
          onChange={(event) => onOrderNoteChange(event.target.value)}
          placeholder="Basal ha gelin, basbaas dheeraad ah..."
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#4F7CFF] focus:ring-2 focus:ring-blue-200"
        />
      </label>

      <PaymentMethodSelector
        paymentMethods={paymentMethods}
        selectedPayment={selectedPayment}
        onSelectPayment={onSelectPayment}
      />

      <div className="space-y-1 rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
        <div className="flex justify-between text-lg">
          <span>Wadarta</span>
          <span className="text-green-300">
            ${roundToTwo(total).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700"
        >
          Nadiifi
        </button>

        <button
          type="button"
          onClick={onCompleteSale}
          className="min-h-11 rounded-lg bg-[#2E7D32] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isDisabled}
        >
          {isSubmitting ? "Waa la farsameynayaa..." : "Dhammaystir iibka"}
        </button>
      </div>

      {statusMessage && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
          {statusMessage}
        </p>
      )}

      <ReceiptPreview receipt={lastReceipt} />
    </section>
  );
}
