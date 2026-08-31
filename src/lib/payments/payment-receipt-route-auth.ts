import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function currentPaymentReceiptUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const staff = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      fullName: true,
      role: true,
      isActive: true,
      station: true,
    },
  });
  return staff?.isActive ? staff : null;
}

export function canTakePayment(
  user: NonNullable<Awaited<ReturnType<typeof currentPaymentReceiptUser>>>,
) {
  return hasPermission(user, PERMISSIONS.PAYMENT_TAKE);
}

export function canManagePaymentReceipts(
  user: NonNullable<Awaited<ReturnType<typeof currentPaymentReceiptUser>>>,
) {
  return hasPermission(user, PERMISSIONS.PAYMENT_RECEIPT_MANAGE);
}
