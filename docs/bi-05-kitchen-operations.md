# BI-05 kitchen operations

BI-05 replaces mutable `updatedAt` timing with append-only station and pickup transition events. Preparation metrics begin only after this migration is deployed; older tickets remain explicitly unavailable.

## Operational rules

- Each station has a configurable 1–240 minute target.
- The target is snapshotted when a station event is written, so later target changes do not rewrite history.
- Preparation duration runs from the first `STATION_STARTED` event through the final `STATION_COMPLETED` event. Reopened work remains in progress until completed again.
- Duplicate status submissions are idempotent and do not create duplicate transition events.
- Late, remake, wrong-order, and waiter-mistake records require a reason and actor.
- Kitchen transition and quality-event rows are append-only; database triggers reject update and delete.
- Equipment, POS, and internet incidents have typed severity, ownership, start/resolution timestamps, and resolution notes.
- Cleaning templates create assigned runs with snapshotted task rows. Required tasks must be completed before the run can be completed, and completion accepts note/URL evidence.

## Deployment

The migration `20260809_kitchen_operations` is forward-only and depends on all BI-01 through BI-04 migrations. It is intentionally not applied by this branch.

After separate approval for the target environment:

```powershell
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```
