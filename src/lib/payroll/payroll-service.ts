import { prisma } from "@/lib/prisma";
import { createPayrollRun } from "@/lib/staff/staff-operations";

export {
  attendanceMinutes,
  attendanceOutcome,
  calculatePayrollLine,
} from "./payroll-formulas";

export async function assertNoFinalizedPayroll(
  workerId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const existing = await prisma.payrollLine.findFirst({
    where: {
      workerId,
      payrollRun: {
        status: "FINALIZED",
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    },
    select: { id: true },
  });
  if (existing)
    throw new Error(
      "A finalized payroll already covers this worker and period.",
    );
}

/** Compatibility entry point; keep all payroll creation on the same validated path. */
export async function buildPayrollRun(input: {
  periodStart: Date;
  periodEnd: Date;
  actorUserId: string;
}) {
  return createPayrollRun(input);
}
