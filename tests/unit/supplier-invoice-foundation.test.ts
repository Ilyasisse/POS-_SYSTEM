import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSupplierInvoiceDraftFromPurchaseOrder,
  calculateSupplierInvoiceLineTotal,
  getSupplierInvoiceVoidEffect,
  type SupplierInvoiceDraftInput,
  validateSupplierInvoiceDraftCreationMetadata,
  validateSupplierInvoiceDraftInput,
} from "../../src/lib/suppliers/invoice-foundation";

function validDraft(
  overrides: Partial<SupplierInvoiceDraftInput> = {},
): SupplierInvoiceDraftInput {
  return {
    invoiceNumber: " PO-1042 ",
    invoiceDate: "2026-07-23",
    dueDate: "2026-07-24",
    notes: " Review complete ",
    lines: [
      {
        kind: "catalog",
        catalogItemId: "catalog-milk",
        itemName: " Milk ",
        itemUnit: " crate ",
        quantity: "2.5",
        unitPrice: "12.40",
      },
      {
        kind: "custom",
        itemName: "Delivery charge",
        itemUnit: "service",
        quantity: "1",
        unitPrice: "3.25",
        notes: "Unexpected transport charge",
      },
    ],
    ...overrides,
  };
}

test("validates catalog and custom lines and calculates totals on the server", () => {
  const draft = validateSupplierInvoiceDraftInput(validDraft());

  assert.equal(draft.invoiceNumber, "PO-1042");
  assert.equal(draft.invoiceDate.toISOString(), "2026-07-23T00:00:00.000Z");
  assert.equal(draft.dueDate.toISOString(), "2026-07-24T00:00:00.000Z");
  assert.equal(draft.notes, "Review complete");
  assert.equal(draft.lines[0].itemName, "Milk");
  assert.equal(draft.lines[0].itemUnit, "crate");
  assert.equal(draft.lines[0].lineTotal.toString(), "31");
  assert.equal(draft.lines[1].supplierCatalogItemId, null);
  assert.equal(draft.totalAmount.toString(), "34.25");
});

test("rounds each invoice line to cents before summing", () => {
  assert.equal(
    calculateSupplierInvoiceLineTotal("1.005", "1.00").toString(),
    "1.01",
  );
  const draft = validateSupplierInvoiceDraftInput(
    validDraft({
      lines: [
        {
          kind: "custom",
          itemName: "First",
          itemUnit: "unit",
          quantity: "1.005",
          unitPrice: "1.00",
        },
        {
          kind: "custom",
          itemName: "Second",
          itemUnit: "unit",
          quantity: "1.005",
          unitPrice: "1.00",
        },
      ],
    }),
  );
  assert.equal(draft.totalAmount.toString(), "2.02");
});

test("rejects invalid dates and empty invoices", () => {
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(
        validDraft({ invoiceDate: "2026-02-29" }),
      ),
    /valid invoice date/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(validDraft({ dueDate: "not-a-date" })),
    /valid supplier bill due date/,
  );
  assert.throws(
    () => validateSupplierInvoiceDraftInput(validDraft({ lines: [] })),
    /at least one invoice item/,
  );
});

test("rejects duplicate catalog items and catalog references on custom lines", () => {
  const catalogLine = validDraft().lines[0];
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(
        validDraft({ lines: [catalogLine, { ...catalogLine }] }),
      ),
    /cannot appear twice/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(
        validDraft({
          lines: [
            {
              kind: "custom",
              catalogItemId: "catalog-milk",
              itemName: "Custom",
              itemUnit: "unit",
              quantity: "1",
              unitPrice: "1",
            },
          ],
        }),
      ),
    /custom lines cannot reference/,
  );
});

test("requires descriptions and units for all invoice lines", () => {
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(
        validDraft({
          lines: [
            {
              kind: "custom",
              itemName: " ",
              itemUnit: "unit",
              quantity: "1",
              unitPrice: "1",
            },
          ],
        }),
      ),
    /description is required/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(
        validDraft({
          lines: [
            {
              kind: "custom",
              itemName: "Charge",
              itemUnit: " ",
              quantity: "1",
              unitPrice: "1",
            },
          ],
        }),
      ),
    /unit is required/,
  );
});

test("enforces quantity and price precision and supported ranges", () => {
  for (const quantity of ["0", "-1", "1.0000", "1e2", "1000000000"]) {
    assert.throws(() =>
      validateSupplierInvoiceDraftInput(
        validDraft({
          lines: [
            {
              kind: "custom",
              itemName: "Charge",
              itemUnit: "unit",
              quantity,
              unitPrice: "1",
            },
          ],
        }),
      ),
    );
  }
  for (const unitPrice of ["-1", "1.001", "1e2", "10000000000"]) {
    assert.throws(() =>
      validateSupplierInvoiceDraftInput(
        validDraft({
          lines: [
            {
              kind: "custom",
              itemName: "Charge",
              itemUnit: "unit",
              quantity: "1",
              unitPrice,
            },
          ],
        }),
      ),
    );
  }
});

test("limits invoice item count and text lengths", () => {
  const lines = Array.from({ length: 101 }, (_, index) => ({
    kind: "custom" as const,
    itemName: `Line ${index}`,
    itemUnit: "unit",
    quantity: "1",
    unitPrice: "1",
  }));
  assert.throws(
    () => validateSupplierInvoiceDraftInput(validDraft({ lines })),
    /at most 100 items/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(
        validDraft({ invoiceNumber: "x".repeat(201) }),
      ),
    /Invoice number is too long/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(
        validDraft({ notes: "x".repeat(2001) }),
      ),
    /Invoice notes is too long/,
  );
});

test("rejects invoice totals outside the database currency range", () => {
  assert.throws(
    () =>
      validateSupplierInvoiceDraftInput(
        validDraft({
          lines: [
            {
              kind: "custom",
              itemName: "First maximum line",
              itemUnit: "unit",
              quantity: "999999999.999",
              unitPrice: "1000.00",
            },
            {
              kind: "custom",
              itemName: "Second maximum line",
              itemUnit: "unit",
              quantity: "999999999.999",
              unitPrice: "1000.00",
            },
          ],
        }),
      ),
    /invoice total exceeds/,
  );
});

test("validates purchase-order and legacy draft creation metadata", () => {
  assert.throws(
    () =>
      validateSupplierInvoiceDraftCreationMetadata({
        supplierId: "supplier-1",
        source: "PURCHASE_ORDER",
        createdByUserId: "user-1",
      }),
    /must reference a purchase order/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftCreationMetadata({
        supplierId: "supplier-1",
        purchaseOrderId: "po-1",
        source: "PURCHASE_ORDER",
      }),
    /require a creator/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftCreationMetadata({
        supplierId: "supplier-1",
        purchaseOrderId: "po-1",
        source: "LEGACY_UPLOAD",
      }),
    /cannot reference a purchase order/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftCreationMetadata({
        supplierId: "supplier-1",
        source: "LEGACY_UPLOAD",
        receiptObjectPath: "supplier/receipt.png",
      }),
    /must be provided together/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftCreationMetadata({
        supplierId: "supplier-1",
        source: "MANUAL",
      }),
    /require a creator/,
  );
  assert.throws(
    () =>
      validateSupplierInvoiceDraftCreationMetadata({
        supplierId: "supplier-1",
        purchaseOrderId: "po-1",
        source: "MANUAL",
        createdByUserId: "user-1",
      }),
    /cannot reference a purchase order/,
  );

  const manualMetadata = validateSupplierInvoiceDraftCreationMetadata({
    supplierId: " supplier-1 ",
    source: "MANUAL",
    createdByUserId: " user-1 ",
  });
  assert.equal(manualMetadata.supplierId, "supplier-1");
  assert.equal(manualMetadata.createdByUserId, "user-1");

  const metadata = validateSupplierInvoiceDraftCreationMetadata({
    supplierId: " supplier-1 ",
    source: "LEGACY_UPLOAD",
    receiptObjectPath: " supplier/receipt.png ",
    receiptContentType: " image/png ",
    uploadedByEmail: " supplier@example.com ",
  });
  assert.equal(metadata.supplierId, "supplier-1");
  assert.equal(metadata.receiptObjectPath, "supplier/receipt.png");
  assert.equal(metadata.receiptContentType, "image/png");
  assert.equal(metadata.uploadedByEmail, "supplier@example.com");
});

test("manual invoice validation allows catalog lines only", () => {
  const catalogOnlyDraft = validDraft({ lines: [validDraft().lines[0]] });
  assert.equal(
    validateSupplierInvoiceDraftInput(catalogOnlyDraft, {
      allowCustomLines: false,
    }).totalAmount.toString(),
    "31",
  );
  assert.throws(
    () => validateSupplierInvoiceDraftInput(validDraft(), { allowCustomLines: false }),
    /only use supplier catalog items/,
  );
});

test("prefills a purchase-order invoice from snapshots using Nairobi dates", () => {
  const input = buildSupplierInvoiceDraftFromPurchaseOrder(
    {
      orderNumber: 1042,
      items: [
        {
          supplierCatalogItemId: "catalog-milk",
          itemName: "Milk crate",
          itemUnit: "crate",
          quantity: "2.500",
          unitPrice: "12.40",
        },
      ],
    },
    new Date("2026-07-22T22:30:00.000Z"),
  );

  assert.equal(input.invoiceNumber, "PO-1042");
  assert.equal(input.invoiceDate, "2026-07-23");
  assert.equal(input.dueDate, "2026-07-24");
  assert.deepEqual(input.lines, [
    {
      kind: "catalog",
      catalogItemId: "catalog-milk",
      itemName: "Milk crate",
      itemUnit: "crate",
      quantity: "2.500",
      unitPrice: "12.40",
    },
  ]);
  assert.equal(
    validateSupplierInvoiceDraftInput(input).totalAmount.toString(),
    "31",
  );
});

test("voiding reopens only purchase-order invoices", () => {
  assert.deepEqual(getSupplierInvoiceVoidEffect(" po-1 "), {
    purchaseOrderId: "po-1",
    reopensPurchaseOrder: true,
  });
  assert.deepEqual(getSupplierInvoiceVoidEffect(null), {
    purchaseOrderId: null,
    reopensPurchaseOrder: false,
  });
});
