import { requireRole } from "@/lib/auth/requireRole";
import WaiterPage from "@/app/components/waiter/WaiterPage";
import { prisma } from "@/lib/prisma";
import {
  getCashierBusinessDayRange,
  getNextCashierBusinessDayResetAt,
} from "@/lib/cashier-business-day";
import { getWaiterBusinessDayShiftSummary } from "@/lib/waiter-shifts";

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
  const shiftSummary = await getWaiterBusinessDayShiftSummary(currentUser.id);
  const canPlaceOrders =
    currentUser.role !== "WAITER" || shiftSummary.status === "open";
  const orderingNotice =
    currentUser.role !== "WAITER"
      ? null
      : shiftSummary.status === "not_opened"
        ? "Go to the cashier and enter your opening balance first before ordering."
        : shiftSummary.status === "closed"
          ? "Your balance is already closed for today. Please go to the cashier."
          : null;

  return (
    <WaiterPage
      fullName={currentUser.fullName}
      totalSales={totalSales}
      nextSalesResetAt={nextSalesResetAt.toISOString()}
      currentUserRole={currentUser.role}
      canPlaceOrders={canPlaceOrders}
      orderingNotice={orderingNotice}
      openingBalance={shiftSummary.openingAmount}
    />
  );
}
