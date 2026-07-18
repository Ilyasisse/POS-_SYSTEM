# Reporting migration and deployment

The sales reporting pages require both stacked BI migrations:

1. `20260718_reporting_foundation`
2. `20260718_sales_integrity`

The second migration adds `Order.customerId`, the order-item cost snapshot columns, and the immutable `SalesAdjustment` table. Opening `/admin/reports` before these columns exist produces Prisma `P2022`; the application converts that condition into a migration-required page and an API `503 REPORT_SCHEMA_NOT_READY` response.

## Safe development or staging order

Confirm that `DATABASE_URL` points to the intended non-production database. Back it up using the database provider's normal process, then run from the latest stacked BI worktree:

```powershell
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run build
```

Restart the application after migration and generation. `prisma migrate deploy` applies pending migration directories in order; do not run `prisma migrate reset`, `prisma db push --force-reset`, or manually add the columns.

Production deployment should run the same status/deploy/generate sequence through the normal controlled release process before starting the new application build. No migration was applied automatically during development.
