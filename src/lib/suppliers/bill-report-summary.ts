import type { Prisma, SupplierPaymentStatus } from "@prisma/client";

export function supplierBillReportWhere({
  supplierId,
  selectedStatus,
  dueThroughTomorrow,
  dueCutoff,
  from,
  to,
}: {
  supplierId?: string;
  selectedStatus?: SupplierPaymentStatus;
  dueThroughTomorrow: boolean;
  dueCutoff: Date;
  from: Date;
  to: Date;
}): Prisma.SupplierBillWhereInput {
  return {
    supplierId,
    status:
      selectedStatus ??
      (dueThroughTomorrow ? { in: ["UNPAID", "PARTIAL"] } : undefined),
    ...(dueThroughTomorrow
      ? { dueDate: { lte: dueCutoff } }
      : { createdAt: { gte: from, lte: to } }),
  };
}

type Amount = { toString(): string } | null;

export type BillStatusSummary = {
  status: "UNPAID" | "PARTIAL" | "PAID";
  _count: { _all: number };
  _sum: { totalAmount: Amount; paidAmount: Amount };
};

export function summarizeBillStatusGroups(
  groups: readonly BillStatusSummary[],
) {
  return groups.reduce(
    (summary, group) => {
      const paidAmount = Number(group._sum.paidAmount ?? 0);
      summary.paid += paidAmount;
      summary.count += group._count._all;
      if (group.status !== "PAID") {
        summary.unpaid += Number(group._sum.totalAmount ?? 0) - paidAmount;
      }
      return summary;
    },
    { unpaid: 0, paid: 0, count: 0 },
  );
}
