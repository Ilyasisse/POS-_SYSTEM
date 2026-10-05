# Staff and customer accounts

The application has two profile tables: `Staff` and `Customer`. There is no
application `User` table. Supabase `auth.users` continues to own login identities
and credentials; each profile's `id` is its verified Supabase Auth user ID.

- `Staff` holds operational accounts, roles, stations and contact information.
  Orders handled by cashiers/waiters, shifts, payroll and staff approvals reference it.
- `Customer` holds customer contact information and account status. Personal orders
  reference it through `Order.customerId`. It has no role or station column.
- An Auth identity can have both profiles. General session resolution prioritizes
  staff, including inactive staff, so disabling a staff account cannot be bypassed
  by falling back to a customer profile. Existing role-based menu access is retained.
- Google signup upserts only `Customer` by verified Auth ID. It never matches or
  grants staff membership by email, never overwrites a staff record, and never
  reactivates a disabled customer. Same-email/different-ID conflicts fail closed.
- Legacy `SUPPLIER` login accounts remain in `Staff` with their existing permissions
  for compatibility; the separate business `Supplier` model is unchanged.

`UserRole` remains the existing permission enum for compatibility. A database
check prohibits `CUSTOMER` values in `Staff`; customer sessions receive that role
in application memory only. Provision a staff member by creating their Supabase
Auth account and inserting a `Staff` record with that exact ID and an explicitly
chosen role. Do not insert into the former application `User` table.

## Activity attribution

`AuditLog`, `StockEvent` and `KitchenTransitionEvent` have two nullable actor links:
`actorUserId` references `Staff` (the existing field name is retained), and
`actorCustomerId` references `Customer`. A database check allows at most one actor.
Customer ordering passes the customer actor to kitchen and inventory services.
Migration moves historical customer actors into the customer link without
changing their IDs. Other user-named foreign-key fields now reference `Staff`.

## Applying the change

Use a coordinated cutover; the old application cannot run against the new schema.

1. Back up any data you want to retain and stop application writes.
2. Run `npx prisma migrate deploy` with the intended database connection.
3. Run `npx prisma generate`, build and start the updated application.
4. Check staff login, Google customer login, a customer order, kitchen tickets,
   inventory activity, and staff/customer dashboard counts.

The migration renames `User` to `Staff`, copies customers to `Customer`, transfers
customer actor links, and removes only customer-role records from `Staff`. Existing
staff personal orders receive a customer profile with the same ID. If a legacy
customer has staff-only history, migration aborts and rolls back instead of
nulling or deleting that history. Review the reported record's intended role
before retrying. Do not reset the database to bypass this check.

RLS is enabled and browser-role grants are revoked for both profile tables.
Server-side Prisma must use the existing privileged server database connection.
Supabase Auth credentials and sessions are not migrated or deleted.

## Verification

```sh
node --test tests/integration/staff-customer-migration.test.mjs
node --import tsx --test tests/unit/profile-resolution.test.ts tests/unit/permissions.test.ts
npx prisma validate
npx prisma generate
npx tsc --noEmit
```

The migration tests run real PostgreSQL through PGlite in memory, require no
external database credentials, and cover preserved history, customer/staff foreign
keys, role restrictions, browser access and transaction rollback.
