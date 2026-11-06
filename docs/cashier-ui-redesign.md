# Cashier UI/UX redesign

## Scope

One responsive implementation of the agreed fast-service mobile, guided-payment, and tablet concepts.

- Settlement: searchable occupied-table cards, bill/check labels, combined amount due, collapsed rounds. Search hides cards instead of unmounting pending payment state.
- Ordering: staff-focused product cards, search/categories, persistent phone cart summary with explicit review, exit from empty table picker, neutral staff typography. Existing wider-screen cart remains beside the menu with a viewport-constrained height.
- Payments: full-height phone dialog, separate payer setup and receipt matching, read-only saved setup, selected payer and remaining balance kept visible, all receipt status filters, original SMS behind details, explanatory eligibility hints, permission-gated reversal controls.
- Customer review: selected checkout and receipt comparison before lists, desktop sticky review panel, mobile jump-to-review action, exact-amount/reason/confirmation requirements retained. Confirmation is invalidated when reviewed data changes.
- Existing takeaway entry point, payment methods, modifiers, barista assignment, notes, feature-gated equal splitting, global toast API, and staff shell are preserved.

## Boundaries

No schema, migration, receipt parser, accounting, authorization, API contract or production configuration changes. UI eligibility hints are not authorization; server checks remain authoritative. Matched payer rows do not imply that a deferred balance is settled.

Closing/reopening the table-payment dialog and changing between steps retains its current in-memory state. Navigating away or reloading is not a persisted-draft feature. The dialog explicitly explains this limitation; durable held-order/payment recovery remains separate work.

## Verification

Run:

```sh
npm ci
npm run prisma:generate
npx next typegen
npx tsc --noEmit
node --import tsx --test tests/unit/cashier-presentation.test.ts tests/unit/cashier-ui-interactions.test.ts
```

The interaction tests mount actual React components and shared Radix UI primitives in Happy DOM. Next router, toast side effects, menu fetch data, AOS and network responses are isolated. One table-filter test substitutes a small stateful payment component to directly verify mount preservation. These are DOM interaction tests, not full browser/layout or live-database tests.

Build uses placeholder local configuration, never production credentials. Browser access to the isolated local server was refused, so no screenshots or authenticated end-to-end claims are supplied. The temporary synthetic review route was removed before commit.

Before merging, review 390px, 768px, and 1280px widths in both themes, including keyboard/safe-area behavior. Exercise a non-production staff session with table rounds, multiple payers, partial receipts, reversal permission checks, a paid-order retry and failed-network recovery.

## Overlapping work

Open PRs for table search (#150), itemized bills (#127), held drafts (#92), payer methods (#55), and customer translations (#183) may touch these components. This PR does not merge their independent business features; reconcile shared-file edits during review.
