# Reporting architecture

Reports follow this dependency direction:

`UI -> authorized API/server component -> validated filters -> report service -> query/calculation layer -> Prisma`

`src/lib/reports/reporting-calendar.ts` is the single source for business ranges. `src/lib/reports/financial-formulas.ts` owns Decimal-safe formulas. Route handlers and React components must not redefine either policy.

The `CafeSetting` singleton records the approved café defaults. Changes to financial settings must be admin-authorized and written to `AuditLog`. New report endpoints must use named permissions from `src/lib/auth/permissions.ts`, validate every filter, paginate detail rows, and serialize Decimal money as strings.

Historical coverage is part of each report contract. Missing cost, customer, kitchen-event, or other newly collected data is displayed as unavailable rather than backfilled from current values.
