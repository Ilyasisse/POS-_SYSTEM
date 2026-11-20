import { expect, test } from "@jest/globals";

import {
  buildSupplierInvoiceDraftFromPurchaseOrder,
  calculateSupplierInvoiceLineTotal,
  getSupplierInvoiceVoidEffect,
  type SupplierInvoiceDraftInput,
  validateSupplierInvoiceDraftCreationMetadata,
  validateSupplierInvoiceDraftInput,
} from "../../src/lib/suppliers/invoice-foundation";

function validDraft(overrides: Partial<SupplierInvoiceDraftInput> = {}): SupplierInvoiceDraftInput {
  return {
    supplierReference: " SUP-1042 ",
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

  expect(draft.supplierReference).toBe("SUP-1042");
  expect(draft.invoiceDate.toISOString()).toBe("2026-07-23T00:00:00.000Z");
  expect(draft.dueDate.toISOString()).toBe("2026-07-24T00:00:00.000Z");
  expect(draft.notes).toBe("Review complete");
  expect(draft.lines[0].itemName).toBe("Milk");
  expect(draft.lines[0].itemUnit).toBe("crate");
  expect(draft.lines[0].lineTotal.toString()).toBe("31");
  expect(draft.lines[1].supplierCatalogItemId).toBe(null);
  expect(draft.totalAmount.toString()).toBe("34.25");
});

test("rounds each invoice line to cents before summing", () => {
  expect(calculateSupplierInvoiceLineTotal("1.005", "1.00").toString()).toBe("1.01");
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
  expect(draft.totalAmount.toString()).toBe("2.02");
});

test("rejects invalid dates and empty invoices", () => {
  expect(() =>
    validateSupplierInvoiceDraftInput(validDraft({ invoiceDate: "2026-02-29" })),
  ).toThrow(/valid invoice date/);
  expect(() => validateSupplierInvoiceDraftInput(validDraft({ dueDate: "not-a-date" }))).toThrow(
    /valid supplier bill due date/,
  );
  expect(() => validateSupplierInvoiceDraftInput(validDraft({ lines: [] }))).toThrow(
    /at least one invoice item/,
  );
});

test("rejects duplicate catalog items and catalog references on custom lines", () => {
  const catalogLine = validDraft().lines[0];
  expect(() =>
    validateSupplierInvoiceDraftInput(validDraft({ lines: [catalogLine, { ...catalogLine }] })),
  ).toThrow(/cannot appear twice/);
  expect(() =>
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
  ).toThrow(/custom lines cannot reference/);
});

test("requires descriptions and units for all invoice lines", () => {
  expect(() =>
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
  ).toThrow(/description is required/);
  expect(() =>
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
  ).toThrow(/unit is required/);
});

test("enforces quantity and price precision and supported ranges", () => {
  for (const quantity of ["0", "-1", "1.0000", "1e2", "1000000000"]) {
    expect(() =>
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
    ).toThrow();
  }
  for (const unitPrice of ["-1", "1.001", "1e2", "10000000000"]) {
    expect(() =>
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
    ).toThrow();
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
  expect(() => validateSupplierInvoiceDraftInput(validDraft({ lines }))).toThrow(
    /at most 100 items/,
  );
  expect(() =>
    validateSupplierInvoiceDraftInput(validDraft({ supplierReference: "x".repeat(201) })),
  ).toThrow(/Supplier reference is too long/);
  expect(() => validateSupplierInvoiceDraftInput(validDraft({ notes: "x".repeat(2001) }))).toThrow(
    /Invoice notes is too long/,
  );
});

test("rejects invoice totals outside the database currency range", () => {
  expect(() =>
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
  ).toThrow(/invoice total exceeds/);
});

test("validates purchase-order and legacy draft creation metadata", () => {
  expect(() =>
    validateSupplierInvoiceDraftCreationMetadata({
      supplierId: "supplier-1",
      source: "PURCHASE_ORDER",
      createdByUserId: "user-1",
    }),
  ).toThrow(/must reference a purchase order/);
  expect(() =>
    validateSupplierInvoiceDraftCreationMetadata({
      supplierId: "supplier-1",
      purchaseOrderId: "po-1",
      source: "PURCHASE_ORDER",
    }),
  ).toThrow(/require a creator/);
  expect(() =>
    validateSupplierInvoiceDraftCreationMetadata({
      supplierId: "supplier-1",
      purchaseOrderId: "po-1",
      source: "LEGACY_UPLOAD",
    }),
  ).toThrow(/cannot reference a purchase order/);
  expect(() =>
    validateSupplierInvoiceDraftCreationMetadata({
      supplierId: "supplier-1",
      source: "RECURRING",
    }),
  ).toThrow(/require a creator/);
  expect(() =>
    validateSupplierInvoiceDraftCreationMetadata({
      supplierId: "supplier-1",
      source: "LEGACY_UPLOAD",
      receiptObjectPath: "supplier/receipt.png",
    }),
  ).toThrow(/must be provided together/);
  expect(() =>
    validateSupplierInvoiceDraftCreationMetadata({
      supplierId: "supplier-1",
      source: "MANUAL",
    }),
  ).toThrow(/require a creator/);
  expect(() =>
    validateSupplierInvoiceDraftCreationMetadata({
      supplierId: "supplier-1",
      purchaseOrderId: "po-1",
      source: "MANUAL",
      createdByUserId: "user-1",
    }),
  ).toThrow(/cannot reference a purchase order/);

  const manualMetadata = validateSupplierInvoiceDraftCreationMetadata({
    supplierId: " supplier-1 ",
    source: "MANUAL",
    createdByUserId: " user-1 ",
  });
  expect(manualMetadata.supplierId).toBe("supplier-1");
  expect(manualMetadata.createdByUserId).toBe("user-1");

  const metadata = validateSupplierInvoiceDraftCreationMetadata({
    supplierId: " supplier-1 ",
    source: "LEGACY_UPLOAD",
    receiptObjectPath: " supplier/receipt.png ",
    receiptContentType: " image/png ",
    uploadedByEmail: " supplier@example.com ",
  });
  expect(metadata.supplierId).toBe("supplier-1");
  expect(metadata.receiptObjectPath).toBe("supplier/receipt.png");
  expect(metadata.receiptContentType).toBe("image/png");
  expect(metadata.uploadedByEmail).toBe("supplier@example.com");
});

test("manual invoice validation allows catalog lines only", () => {
  const catalogOnlyDraft = validDraft({ lines: [validDraft().lines[0]] });
  expect(
    validateSupplierInvoiceDraftInput(catalogOnlyDraft, {
      allowCustomLines: false,
    }).totalAmount.toString(),
  ).toBe("31");
  expect(() =>
    validateSupplierInvoiceDraftInput(validDraft(), {
      allowCustomLines: false,
    }),
  ).toThrow(/only use supplier catalog items/);
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

  expect(input.supplierReference).toBe(null);
  expect(input.invoiceDate).toBe("2026-07-23");
  expect(input.dueDate).toBe("2026-07-24");
  expect(input.lines).toStrictEqual([
    {
      kind: "catalog",
      catalogItemId: "catalog-milk",
      itemName: "Milk crate",
      itemUnit: "crate",
      quantity: "2.500",
      unitPrice: "12.40",
    },
  ]);
  expect(validateSupplierInvoiceDraftInput(input).totalAmount.toString()).toBe("31");
});

test("voiding reopens only purchase-order invoices", () => {
  expect(getSupplierInvoiceVoidEffect(" po-1 ")).toStrictEqual({
    purchaseOrderId: "po-1",
    reopensPurchaseOrder: true,
  });
  expect(getSupplierInvoiceVoidEffect(null)).toStrictEqual({
    purchaseOrderId: null,
    reopensPurchaseOrder: false,
  });
});
