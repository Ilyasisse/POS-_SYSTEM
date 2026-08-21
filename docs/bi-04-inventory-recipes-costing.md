# BI-04 inventory, recipes, and costing

BI-04 introduces Decimal inventory quantities, canonical units, versioned recipes, immutable stock events, supplier receipt conversions, audited standard costs, and physical counts.

## Data coverage

- `COMPLETE`: the quantity has a confirmed canonical unit and, where a value is reported, a standard cost.
- `LEGACY_INCOMPLETE`: the original unit was not recognized confidently. Its historical numeric quantity is retained unchanged until an administrator supplies an explicit mapping factor.
- `MISSING_COST`: the quantity is known but no standard cost snapshot exists. Reports must show the cost/value as unavailable.

The migration converts only recognized aliases for grams, kilograms, millilitres, litres, and pieces. It converts kg to grams and litres to millilitres. It does not invent carton, bag, bottle, or other supplier-unit factors.

## Inventory rules

- Canonical units are `GRAM`, `MILLILITRE`, and `PIECE`.
- Purchase-unit conversions are configured per supply and supplier unit.
- A sale with an effective recipe deducts recipe ingredients according to sold quantity divided by recipe yield.
- A tracked product without a recipe deducts finished product stock in pieces.
- Refunds and sales adjustments do not restore ingredient or finished-item usage.
- Finalizing a supplier invoice records receipt events only for resolvable inventory targets. Unresolved lines remain incomplete.
- Supplier prices never update standard inventory cost automatically.
- `StockEvent` is append-only; a database trigger rejects update and delete.
- Count approval creates `COUNT_VARIANCE` events and cannot approve a draft or already-approved session.

## Deployment prerequisite

Do not deploy this migration until the BI-01 through BI-03 migrations are already applied. For an explicitly approved development/staging database, inspect first:

```powershell
npx prisma migrate status
```

Then deploy pending migrations in repository order:

```powershell
npx prisma migrate deploy
npx prisma generate
```

The BI-04 implementation does not run `migrate deploy` automatically.
