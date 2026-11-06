import { receiptHref, type ReceiptFormat } from "@/lib/orders/receipt-format";
import PrintButton from "./PrintButton";

export default function ReceiptActions({
  orderId,
  format,
}: {
  orderId: string;
  format: ReceiptFormat;
}) {
  return (
    <div className="no-print mx-auto mb-5 max-w-lg space-y-3 print:hidden">
      <nav aria-label="Receipt format" className="grid grid-cols-2 gap-2">
        {(
          [
            ["full", "Full Page Receipt"],
            ["thermal", "80 mm Thermal Receipt"],
          ] as const
        ).map(([value, label]) => (
          // A full document navigation keeps each format's @page rules isolated.
          <a
            key={value}
            href={receiptHref(orderId, value)}
            aria-current={format === value ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-lg border px-3 py-2 text-center text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${
              format === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            {label}
          </a>
        ))}
      </nav>
      <PrintButton />
      <p
        id="receipt-pdf-help"
        className="text-center text-xs text-muted-foreground"
      >
        Save as PDF opens Chrome&apos;s print dialog; choose Destination → Save
        as PDF.
        {format === "thermal"
          ? " Uses 80 × 200 mm pages; long receipts continue on additional pages."
          : ""}
      </p>
    </div>
  );
}
