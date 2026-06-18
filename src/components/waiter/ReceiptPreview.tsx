import type { ReceiptSnapshot } from "@/lib/types";

type ReceiptPreviewProps = {
  receipt: ReceiptSnapshot | null;
};

export default function ReceiptPreview({ receipt }: ReceiptPreviewProps) {
  if (!receipt) return null;

  const lines = Array.isArray(receipt.lines) ? receipt.lines : [];

  return (
    <article className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="text-sm font-bold">Receipt #{receipt.receiptNo}</p>
      <p className="text-slate-500">{receipt.createdAt}</p>
      <p className="text-slate-500">Waiter: {receipt.waiterName}</p>
      <p className="mb-2 text-slate-500">
        Total: ${Number(receipt.total).toFixed(2)}
      </p>

      <div className="space-y-2">
        {lines.length === 0 ? (
          <p className="text-slate-500">There are no items on this receipt.</p>
        ) : (
          lines.map((line, index) => (
            <div key={line.id ?? `${line.name}-${index}`}>
              <div className="flex justify-between">
                <span>
                  {line.quantity}x {line.name}
                </span>
                <span>${Number(line.finalPrice ?? 0).toFixed(2)}</span>
              </div>

              {line.selectedModifiers.length > 0 ? (
                <div className="mt-1 space-y-0.5 pl-2 text-slate-500">
                  {line.selectedModifiers.map((modifier) => (
                    <p key={`${line.id}-${modifier.optionId}`}>
                      + {modifier.optionName}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </article>
  );
}
