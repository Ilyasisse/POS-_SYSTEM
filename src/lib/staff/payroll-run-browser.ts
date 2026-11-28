export const PAYROLL_RUN_PAGE_SIZE = 12;

export const payrollRunStatuses = [
  "ALL",
  "DRAFT",
  "APPROVED",
  "FINALIZED",
  "VOIDED",
] as const;

export function payrollRunBrowserParams(
  status: string | undefined,
  page: string | undefined,
) {
  const selectedStatus =
    payrollRunStatuses.find((choice) => choice === status) ?? "ALL";
  const requestedPage = Number(page);
  return {
    status: selectedStatus,
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
  };
}

export function boundedPayrollRunPage(page: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / PAYROLL_RUN_PAGE_SIZE));
  return { page: Math.min(page, pages), pages };
}
