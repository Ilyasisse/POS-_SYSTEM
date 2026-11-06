"use client";

import { FileDown, Printer } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { prepareThermalReceiptForPrint } from "@/lib/orders/receipt-print";

export default function PrintButton() {
  useEffect(() => {
    window.addEventListener("beforeprint", prepareThermalReceiptForPrint);
    return () =>
      window.removeEventListener("beforeprint", prepareThermalReceiptForPrint);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" onClick={() => window.print()}>
        <Printer aria-hidden="true" /> Print Receipt
      </Button>
      <Button
        type="button"
        variant="outline"
        aria-describedby="receipt-pdf-help"
        onClick={() => window.print()}
      >
        <FileDown aria-hidden="true" /> Save as PDF
      </Button>
    </div>
  );
}
