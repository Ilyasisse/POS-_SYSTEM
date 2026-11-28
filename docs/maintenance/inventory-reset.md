# Inventory and linked supplier reset — prepared, not executed

## Status

The requested one-time cleanup was prepared and tested on branch `inventory-item-edit`.
The live execution was rejected by automatic approval review before it ran. The stated
reason was major irreversible deletion of inventory, supplier invoices/orders, payments,
and finalized cash-linked records, including temporary suspension of the ledger's
immutability trigger. The review explicitly said authorization did not override the block.

Do not retry this blocked operation through another tool, user interface, or execution
route. A narrower, separately agreed scope would need a new review.

No records were deleted by this maintenance operation. The ledger trigger remains enabled.
This work does not add a reset button or run during application build/deployment.

## Reviewed scope

The read-only manifest for cafeteria `mashallah` identified:

| Table                         | Targeted rows |
| ----------------------------- | ------------: |
| InventorySupply               |            27 |
| InventoryMovement             |            66 |
| StockEvent                    |             2 |
| SupplierCatalogItem           |            18 |
| SupplierPurchaseOrder         |            47 |
| SupplierPurchaseOrderItem     |            57 |
| SupplierInvoice               |           245 |
| SupplierInvoiceItem           |           345 |
| SupplierBill                  |            75 |
| SupplierInvoiceInstallment    |            45 |
| SupplierPayment               |            74 |
| SupplierPaymentAllocation     |            75 |
| DailyCashSupplierPayment      |            21 |
| SupplierInvoiceRecurrence     |             2 |
| SupplierInvoiceRecurrenceItem |             3 |

The targeted payments total 1,604.71. Their Daily Cash links span August 8–12, 2026,
including three finalized days. Twelve other supplier invoices and two other payments
were outside the reviewed deletion set.

## Prepared tooling

`scripts/maintenance/inventory-reset.mjs` builds a read-only manifest and an offline SQL
artifact; it never connects to or changes a database itself. The manifest records exact
IDs, counts, input fingerprints, schema/trigger fingerprints, shared-dependency checks,
and survivor fingerprints. Runtime manifests and generated SQL remain outside Git.

The prepared transaction uses scoped row IDs, checks for drift, verifies deletion counts,
and checks surviving rows and protected tables. It restores the ledger trigger in the
same transaction. Its cash recalculation stays inside the database rather than exporting
financial or staff records. It preserves unrelated sales, staff, payroll, manual expenses,
supplier accounts, daily supply purchases, and uploaded files.

The preliminary broad cash-data read was also rejected. It was replaced with server-side
calculation using only a returned manifest and aggregate results; no broad cash snapshot
was exported.

## Isolated verification

Run `node tests/integration/inventory-reset.test.mjs` for the four PGlite tests:

- Recursive invoice/recurrence closure and receiving/scheduled-run dependencies.
- Scoped deletion with surviving invoices, payments, another cafeteria, and cash records.
- Cash-summary agreement with the application's calculation and exact fingerprint format.
- Drift/shared-dependency refusal and complete rollback after a late transaction failure,
  including restoration of the stock-event immutability trigger.

Scoped ESLint and `git diff --check` pass. Live read-only verification after the rejection
confirmed all 27 inventory items, 66 movements, 2 ledger entries, 257 supplier invoices,
76 supplier payments, and 3 finalized cash days remained; the ledger trigger was enabled.
