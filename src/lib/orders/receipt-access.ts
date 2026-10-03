import type { UserRole } from "@prisma/client";
import { canAccessOrder, type PermissionUser } from "@/lib/auth/permissions";

type ReceiptUser = PermissionUser & { role: UserRole };
type ReceiptOrder = {
  customerId: string | null;
  waiterId: string | null;
  cashierId: string | null;
};

export function canViewOrderReceipt(user: ReceiptUser, order: ReceiptOrder) {
  return user.role === "CUSTOMER"
    ? order.customerId === user.id
    : canAccessOrder(user, order);
}
