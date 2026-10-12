# Cafeterias on separate domains

Each hostname resolves to one cafeteria. Staff profiles, products, orders, inventory,
reports, and the rest of the operational tables have a cafeteriaId. Products remain
in one Product table. Unknown or archived domains fail closed; staff signing in on
another cafeteria's domain cannot resolve their profile.

## Deployment

This is a draft implementation. Validate the migration against a disposable copy of
the existing database and run the full build and tests before production rollout.
No production database or hosting configuration has been changed by this PR.

1. Back up the database. Put the exact current hostname (without https:// or a path)
   in the server environment variable MASHALLAH_DOMAIN.
2. Run npm ci, npm run prisma:generate, and npx prisma migrate deploy using the
   database administrator connection. The migration creates a non-login,
   non-bypass-RLS role named pos_cafeteria_runtime and grants it to the migration
   user. If DATABASE_URL uses a different database role, explicitly grant
   pos_cafeteria_runtime to that role as well. It must have no Bypass RLS permission.
3. Designate the current Mashallah administrator by verified Supabase Auth ID:

   UPDATE "Staff" SET "isPlatformAdmin" = true
   WHERE "id" = '<verified-existing-admin-id>'
     AND "cafeteriaId" = 'mashallah' AND "role" = 'ADMIN';

4. Deploy the code together with the migration. Sign in on Mashallah and open
   /admin/cafeterias using the new management link.
5. Create a cafeteria and register its hostname. Add that hostname to the same
   hosting project and configure DNS and TLS through your host.
6. Provision its administrator and other staff. SUPABASE_SERVICE_ROLE_KEY must
   exist on the server for account creation. The key never goes to the browser.

Archiving blocks access while preserving sales history. Domains can be removed.
Staff can be deactivated, reactivated, or assigned different roles and stations.
Existing staff are not moved between cafeterias because their historical orders
and financial records belong to their original cafeteria. Create another account
for another cafeteria; Supabase Auth requires a distinct email address.

## Data access contract

Application code uses src/lib/prisma.ts. Each operation runs in a transaction
with SET LOCAL ROLE pos_cafeteria_runtime and a transaction-local cafeteria ID.
PostgreSQL RLS covers nested relations, aggregations, raw SQL, and writes.
Tenant-qualified foreign keys reject associations to another cafeteria's rows.
An ownership trigger rejects reassignment and platform privilege escalation.

src/lib/database.ts is privileged. Import it only for hostname resolution and
explicitly authorized platform management. Do not use it in operational routes.
Browser Data API access to operational tables is revoked; use existing server APIs.

Natural unique indexes are SQL-owned and include cafeteriaId while Prisma retains
the original logical selector names for existing callers. The scoped client
serializes upserts with advisory locks. Use committed migrations, never db push;
review future migration diffs to preserve tenant-qualified indexes and foreign keys.
The singleton settings and scheduler keys are prefixed internally by cafeteria ID.

Realtime broadcasts use cafeteria:<id>:kitchen:tickets and
cafeteria:<id>:report-invalidations. Consumers must use these private topics;
the old shared topics are blocked. Authorization checks active Staff membership,
not editable user_metadata.

Background jobs and scripts must run within withCafeteria(id, work). HTTP cron and
webhook requests must use the corresponding configured cafeteria domain. Existing
provider credentials remain hosting environment configuration; verify each
cafeteria's provider setup before enabling its payments and scheduled messaging.

## Verification still required before merging

- Full Prisma generation, TypeScript, lint, and application build.
- Migration from the current schema on disposable PostgreSQL, including legacy
  singleton records, tenant-qualified uniqueness, implicit relations, and FK actions.
- Two-domain browser test: staff login, product/category creation, checkout, reports.
- Cross-cafeteria read/write rejection, platform privilege rejection, and direct
  Supabase Data API rejection.
- Native/nested Prisma upsert, createMany, and transaction behavior under RLS.
- Realtime, existing cron/webhook integrations, and seed/maintenance scripts.
