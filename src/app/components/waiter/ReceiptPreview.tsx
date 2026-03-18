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
      <p className="mb-2 text-slate-500">{receipt.createdAt}</p>

      <div className="space-y-1">
        {lines.length === 0 ? (
          <p className="text-slate-500">No receipt items.</p>
        ) : (
          lines.map((line, index) => (
            <div
              key={line.id ?? `${line.name}-${index}`}
              className="flex justify-between"
            >
              <span>
                {line.quantity}x {line.name}
              </span>
              <span>${Number(line.finalPrice ?? 0).toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
