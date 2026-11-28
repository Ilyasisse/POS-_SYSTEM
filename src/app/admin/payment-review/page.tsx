import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import CustomerFulfillmentBoard from "@/components/cashier/CustomerFulfillmentBoard";
import CustomerCheckoutReview from "@/components/cashier/CustomerCheckoutReview";
import PaymentReceiptReview from "@/components/admin/PaymentReceiptReview";
export default async function PaymentReviewPage() {
  await requirePermission(PERMISSIONS.PAYMENT_RECEIPT_MANAGE);
  return (
    <>
      <CustomerCheckoutReview admin />
      <PaymentReceiptReview />
      <CustomerFulfillmentBoard />
    </>
  );
}
