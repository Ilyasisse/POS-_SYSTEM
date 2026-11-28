# Inventory dates and cafeteria context

Inventory and admin inventory accept an Inventory date for withdrawals and restocks.
The selected date filters activity; displayed stock is always the current balance.
Submitting a backdated movement changes current stock immediately. It does not rebuild
historical balances. Set stock and supply-detail corrections remain current operations.

Dates use Africa/Nairobi. Today keeps the actual event time; a past date is stored at
noon Nairobi and displayed as a date. `createdAt` preserves when staff entered it.
Both `StockEvent.occurredAt` and `InventoryMovement.occurredAt` receive the same value.

## Withdrawal failure

The hosted database requires `cafeteriaId` on stock events, movements, and audit rows,
with a default from `app.cafeteria_id`. The application was not setting that context,
so stock-event inserts failed and the entire withdrawal rolled back.

Inventory mutations now resolve cafeteria ownership from the verified staff ID and
selected supply inside the transaction. Mismatched ownership is rejected. The context
is transaction-local, so pooled connections cannot leak it to the next request. The
original repository schema without cafeteria columns remains supported; no cafeteria
IDs come from form submissions and no ownership constraints are weakened.

## Rollout

Apply `20261118054712_inventory_movement_dates` before deploying this code. It adds an
occurrence timestamp, backfills only missing values from `createdAt`, and adds indexes.
It leaves quantities, names, units, entry timestamps, and existing history intact.
The SQL is repeatable, including after backdated records have been entered.

On 2026-11-18 this migration was applied to the connected Supabase database. Verification
found 66 movement rows, zero missing occurrence dates, and all backfilled dates matching
the original creation timestamps. Production stock was not used for testing.

The live database also has existing cafeteria columns and ownership constraints outside
this branch's Prisma migration history. Deploy only the reviewed additive date migration;
do not use schema push/reset or replay unrelated pending migrations to reconcile that drift.

## Verification

`node tests/integration/inventory-movement-dates.test.mjs` executes the real withdrawal,
restock, edit, and stock-correction actions and ledger against isolated PGlite fixtures.
It covers the original failure, cafeteria defaults, cross-cafeteria rejection, fractional
quantities, stale units, invalid dates, atomic rollback, backfill preservation, and date
boundaries. It also checks that cafeteria context does not outlive the transaction.
