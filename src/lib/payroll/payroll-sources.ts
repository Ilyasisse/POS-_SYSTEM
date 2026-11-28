type EmploymentPeriod = {
  userId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export function attendanceForEmployment<
  T extends {
    workerId: string;
    businessDate: Date;
    status: string;
    approvedAt: Date | null;
  },
>(attendance: readonly T[], profile: EmploymentPeriod): T[] {
  return attendance.filter(
    (row) =>
      row.workerId === profile.userId &&
      row.status === "PRESENT" &&
      row.approvedAt !== null &&
      row.businessDate >= profile.effectiveFrom &&
      (!profile.effectiveTo || row.businessDate <= profile.effectiveTo),
  );
}

export function adjustmentWithinPayrollPeriod(
  adjustment: { periodStart: Date; periodEnd: Date },
  period: { periodStart: Date; periodEnd: Date },
) {
  return (
    adjustment.periodStart >= period.periodStart &&
    adjustment.periodEnd <= period.periodEnd
  );
}
