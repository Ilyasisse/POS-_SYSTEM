import { requireRole } from "@/lib/auth/requireRole";
import WaiterPage from "@/app/components/waiter/WaiterPage";
import { prisma } from "@/lib/prisma";
import {
  getCashierBusinessDayRange,
  getNextCashierBusinessDayResetAt,
} from "@/lib/cashier-business-day";

export default async function Page() {
  const currentUser = await requireRole(["WAITER", "ADMIN"]);
  const { start: businessDayStart, end: businessDayEnd } =
    getCashierBusinessDayRange();

  const salesSummary = await prisma.order.aggregate({
    where: {
      waiterId: currentUser.id,
      createdAt: {
        gte: businessDayStart,
        lt: businessDayEnd,
      },
    },
    _sum: {
      total: true,
    },
  });

  const totalSales = Number(salesSummary._sum.total ?? 0);
  const nextSalesResetAt = getNextCashierBusinessDayResetAt();

  return (
    <WaiterPage
      fullName={currentUser.fullName}
      totalSales={totalSales}
      nextSalesResetAt={nextSalesResetAt.toISOString()}
    />
  );
}
