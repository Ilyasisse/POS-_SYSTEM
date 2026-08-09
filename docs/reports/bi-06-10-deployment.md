# BI-06–BI-10 deployment and rollback

Deploy the five migrations in their existing lexical order only after reviewing the branch. They are forward-only and this feature does not run `prisma migrate deploy` itself.

Set the server-only `SUPABASE_SERVICE_ROLE_KEY` to enable private report invalidation broadcasts. It must never be exposed through `NEXT_PUBLIC_*`. Realtime is best-effort; the 60-second report refresh remains available if Supabase broadcast is unavailable.

Rollback application code first. Do not delete payroll, expense, attendance, receiving, feedback, complaint, or export-audit records. If a migration rollback is absolutely required, use a separately reviewed recovery migration; the production migration history must remain intact.

Historical coverage begins only when each source feature was introduced. Reports return coverage metadata rather than fabricated values. Customer metrics include only explicitly identified paid orders.

| Requirement | Primary files | Verification |
| --- | --- | --- |
| Attendance/payroll | `EmploymentProfile`, `AttendanceRecord`, `PayrollRun`, `payroll-service.ts` | `payroll-service.test.ts` |
| Finance/suppliers/customers | `ExpenseTransaction`, `OwnerWithdrawal`, `SupplierReceiving`, `ComplaintCase` | report endpoint authorization and service tests |
| Advanced reports | `advanced-report-service.ts`, `/api/admin/reports/*` | TypeScript + report tests |
| Export/realtime | `export-service.ts`, `report-realtime.ts` | format and payload-privacy tests |
