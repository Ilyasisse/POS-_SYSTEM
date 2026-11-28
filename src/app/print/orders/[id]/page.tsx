import { getOrderReceipt } from "@/lib/orders/get-order-receipt";
import FullPageReceipt from "./entire-page-receipt/FullPageReceipt";
import ReceiptActions from "./ReceiptActions";

export default async function PrintableOrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receipt = await getOrderReceipt(id);

  return (
    <main className="min-h-dvh bg-muted/30 p-4 text-foreground print:min-h-0 print:bg-white print:p-0">
      <ReceiptActions orderId={id} format="full" />
      <FullPageReceipt receipt={receipt} />
    </main>
  );
}
