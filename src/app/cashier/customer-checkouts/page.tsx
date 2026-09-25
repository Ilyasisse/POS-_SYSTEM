import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/auth/permissions";
import CustomerCheckoutReview from "@/components/cashier/CustomerCheckoutReview";

export default async function CustomerCheckoutReviewPage() {
  await requirePermission(PERMISSIONS.PAYMENT_TAKE);
  return <CustomerCheckoutReview />;
}
