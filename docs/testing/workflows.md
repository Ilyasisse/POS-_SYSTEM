# Cafe POS workflow tests

Use a dedicated Git worktree, Node 24, Docker with a Linux engine, and Chromium. Run these commands from the worktree.

```powershell
npm ci
npx playwright install chromium
npm test
npm run test:integration
npm run test:e2e
```

`npm test` runs the fast unit, mocked route, and migration regressions. The other commands start a fresh PostgreSQL database, a standalone Supabase Auth service, and Next.js. They use ports 55421, 55422, 55424 and 55430 on loopback. Run one workflow command at a time. Each command tears down its own containers and network on exit.

Run the workflow suites from a checkout without a development `.env`. The runner supplies local addresses and disposable credentials. Prisma provisions the current application schema and `tests/workflow/constraints.sql` adds the SQL-only invariants these workflows exercise. The existing migration tests cover upgrades separately.

## Job groups

| Job                                | Integration                    | Browser             |
| ---------------------------------- | ------------------------------ | ------------------- |
| Staff access                       | `auth`                         | `staff-access`      |
| Cashier, kitchen and waiter        | `api-orders`, `kitchen-waiter` | `cashier-flow`      |
| Customer checkout and fulfillment  | `customer-checkout`            | `customer-checkout` |
| Catalog and inventory              | `api-products`, `inventory`    | `inventory-catalog` |
| Purchasing and suppliers           | `suppliers`                    | `suppliers`         |
| Manager and admin reconciliation   | `reconciliation`               | `reconciliation`    |
| Attendance, payroll and operations | `staff-operations`             | `staff-operations`  |

Set `CAFE_POS_TEST_SCOPE=core` to run the staff access, cashier/kitchen/waiter, and customer checkout cases, as on pull requests. The nightly and manually dispatched CI workflow runs every job group. To run one browser spec, use `npm run test:e2e -- cashier-flow.spec.ts`.

The checkout suites submit synthetic SAHAL messages to the local MacroDroid route. Live Google OAuth, physical dialer behavior, and third-party delivery still require staging checks. Playwright failure screenshots and traces are kept in the local `test-results/workflows` directory.
