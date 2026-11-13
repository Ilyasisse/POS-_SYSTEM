export const ATTENDANCE_BACKLOG_PAGE_SIZE = 25;

export function attendanceBacklogPage(
  rawPage: string | undefined,
  total: number,
) {
  const pageCount = Math.max(
    1,
    Math.ceil(total / ATTENDANCE_BACKLOG_PAGE_SIZE),
  );
  const requested = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(requested)
    ? Math.min(Math.max(requested, 1), pageCount)
    : 1;
  return { page, pageCount, skip: (page - 1) * ATTENDANCE_BACKLOG_PAGE_SIZE };
}
