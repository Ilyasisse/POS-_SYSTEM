import { getOrderReceipt } from "@/lib/orders/get-order-receipt";
import ReceiptActions from "../ReceiptActions";
import ThermalReceipt from "./ThermalReceipt";
import { thermalReceiptCss } from "./thermal-receipt-styles";

export default async function ThermalOrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receipt = await getOrderReceipt(id);
  return (
    <main className="thermal-preview">
      <style>{thermalReceiptCss}</style>
      <ReceiptActions orderId={id} format="thermal" />
      <ThermalReceipt receipt={receipt} />
    </main>
  );
}
