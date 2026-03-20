import { translatePaymentMethod } from "@/lib/ui-text";

type PaymentMethodSelectorProps = {
  paymentMethods: string[];
  selectedPayment: string;
  onSelectPayment: (method: string) => void;
};

export default function PaymentMethodSelector({
  paymentMethods,
  selectedPayment,
  onSelectPayment,
}: PaymentMethodSelectorProps) {

  

  return (
    <div className="rounded-xl border border-slate-200 p-3 text-sm">
      <p className="mb-2 font-semibold text-slate-700">
        Habka Lacag Bixinta
      </p>

      <div className="grid grid-cols-3 gap-2">
        {paymentMethods.map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => onSelectPayment(method)}
            className={`min-h-11 rounded-lg text-sm font-semibold transition ${
              selectedPayment === method
                ? "bg-[#4F7CFF] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {translatePaymentMethod(method)}
          </button>
        ))}
      </div>
    </div>
  );
}
