# Inventory-only cleanup — rolled back; revised scope required

The requested inventory-only operation was prepared in `inventory-item-edit` with no
invoice, payment, cash, or ledger mutations and no disabled triggers. The user also
requested clearing the visible movement history of the two retained items, expanding
the movement scope from 45 to all 66 Supply movements.

The live transaction did not complete. PostgreSQL rejected unlinking a supplier catalog
entry because `SupplierCatalogItem_exactly_one_target_check` requires exactly one
inventory-supply or menu-product target. Clearing the inventory target on an entry with
no product target violates that rule. The transaction rolled back in full.

Read-only verification afterward found all 27 items, all 66 movement rows, and both
protected ledger entries still present. The protected items are Saliid (Kg) and Sonkor
(Kg), each with one ledger entry. No records were deleted or hidden.

Of the other 25 items, 16 are targets of 18 supplier catalog entries, and 9 have no
catalog references. Preserving financial records and all current constraints therefore
requires a revised choice: delete only the 9 unlinked items, or delete those 9 and hide
the 16 supplier-linked items while retaining their required rows. Neither revised
operation has been executed. Clearing movement history would retain the two immutable
ledger entries.

## Tooling

`scripts/maintenance/inventory-only-reset.mjs` prepares a manifest and an offline SQL
artifact. It never connects to a database or runs during application builds. It refuses
to prepare a catalog-unlink transaction when the hosted exactly-one-target rule exists.
Its schema fingerprint now covers check constraints as well as foreign keys and triggers.

The transaction verifies input and survivor fingerprints, catalog content, financial
records, ledger protection, exact row counts, and absence of new dependencies. It has
no trigger-changing, ledger-changing, or financial-deletion statements.

## Tests

`node tests/integration/inventory-only-reset.test.mjs` passes five isolated PGlite tests:
manifest scope; deletion under a schema permitting standalone catalog entries; preservation
of protected rows and financial records; drift and late-failure rollback; and refusal
of the actual hosted catalog target constraint before a transaction is prepared.

The hosted constraint was not represented in the first fixture. It is now explicitly
covered. Scoped ESLint and `git diff --check` pass. Runtime manifests and generated SQL
are kept outside Git.
