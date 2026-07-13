# Waiter End-Day Balances

## Purpose

This feature gives administrators a dated end-of-day ledger for waiter sales and money handed in. Shortages remain attached to the waiter and carry into later POS business days instead of resetting to zero.

## Access and routes

- Admins with `waiter.balance.admin` can use `/admin/waiter-balances`.
- Managers keep their existing current-day opening and closing controls.
- Waiters continue to use the existing shift-status ordering gate.

## Accounting rules

- The ledger starts on the July 1, 2026 POS business day. Earlier shifts are not imported.
- Every waiter receives one opening balance of zero or less. This initialization is immutable.
- The resulting balance is `min(0, opening balance + end-day amount - reported sales)`.
- A surplus repays existing debt but never creates a positive carry-over.
- Missing settlement days leave the existing balance unchanged.
- Correcting a daily settlement recalculates the opening balance snapshots on later records.

Manual reported sales drives the ledger calculation. The order total calculated by the POS is displayed separately as a reference.

## Database changes

`WaiterBalanceInitialization` stores the immutable opening balance, effective date, creator, and creation time. Post-activation `Shift` records store a unique business date, reported sales, the settling user, and an update timestamp. Legacy shifts keep null values in the new nullable columns.

Migration: `20260629_waiter_balance_ledger`.

## Validation and security

- Initialization requires zero or a negative amount and can be created only once.
- Reported sales and end-day amounts must be finite, nonnegative values.
- Future dates and dates before July 1, 2026 are rejected on the server.
- Server actions require the admin-only waiter-balance permission.
- Multi-record carry-over changes run in serializable Prisma transactions.

## Error, loading, and empty states

The admin screen identifies uninitialized waiters, open shifts, missing settlements, and closed settlements. It provides explicit activation, empty, pending, success, and validation feedback using the canonical shadcn/ui patterns.

## Testing checklist

- Lock each waiter's one-time opening balance.
- Record an exact end day, a shortage, and repayment of an old shortage.
- Confirm surplus never carries as a positive value.
- Correct an old settlement and verify later opening balances update.
- Verify POS-reference sales do not replace manually entered sales.
- Verify managers can still close the current day and waiters remain gated by shift status.
- Verify unauthorized users, future dates, and pre-activation dates are rejected.

## Environment variables

No new environment variables are required.

## Known limitation

The feature is a single-cafe ledger and uses the existing POS business-day definition. It does not import or reconcile balances from before July 1, 2026.
