import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPLIER_RECEIPT_MAX_BYTES,
  isValidSupplierSlug,
  normalizeEmail,
  normalizeSupplierSlug,
  receiptExtension,
  safeInternalReturnPath,
  validateSupplierReceipt,
} from "../../src/lib/suppliers/validation";
import {
  getOpenAIInvoiceConfig,
  validateExtractedInvoice,
} from "../../src/lib/openai/invoice-extraction";
import { validateInvoiceReviewRows } from "../../src/lib/suppliers/invoice-review";

test("normalizes supplier identity fields", () => {
  assert.equal(normalizeEmail("  Supplier@Example.COM "), "supplier@example.com");
  assert.equal(normalizeSupplierSlug(" Fresh Beans Ltd. "), "fresh-beans-ltd");
  assert.equal(isValidSupplierSlug("fresh-beans-ltd"), true);
  assert.equal(isValidSupplierSlug("../fresh"), false);
});

test("only permits internal OAuth return paths", () => {
  assert.equal(safeInternalReturnPath("/supplier/fresh-beans?ready=1"), "/supplier/fresh-beans?ready=1");
  assert.equal(safeInternalReturnPath("//evil.example/path"), null);
  assert.equal(safeInternalReturnPath("https://evil.example/path"), null);
});

test("accepts invoice image formats and rejects unsupported or oversized files", () => {
  assert.doesNotThrow(() => validateSupplierReceipt({ type: "image/jpeg", size: 1024 } as File));
  assert.equal(receiptExtension("image/webp"), "webp");
  assert.throws(
    () => validateSupplierReceipt({ type: "image/heic", size: 1024 } as File),
    /HEIC and HEIF are not supported/,
  );
  assert.throws(
    () => validateSupplierReceipt({ type: "image/png", size: SUPPLIER_RECEIPT_MAX_BYTES + 1 } as File),
    /between 1 byte and 10 MB/,
  );
});

test("validates a complete structured OpenAI invoice extraction", () => {
  const result = validateExtractedInvoice({
    transcription: "SALES RECEIPT\nEast Repair Inc.\nTOTAL $154.06",
    supplierName: "East Repair Inc.",
    invoiceNumber: "US-001",
    invoiceDate: "2019-02-11",
    subtotal: 145,
    tax: 9.06,
    discount: null,
    total: 154.06,
    items: [{
      description: "Front and rear brake cables",
      quantity: 1,
      unitPrice: 100,
      totalPrice: 100,
      confidence: 0.98,
      notes: null,
    }],
  });
  assert.equal(result.invoiceNumber, "US-001");
  assert.equal(result.items[0]?.description, "Front and rear brake cables");
  assert.equal(result.total, 154.06);
});

test("accepts uncertain handwritten fields as null and rejects malformed output", () => {
  const result = validateExtractedInvoice({
    transcription: "HAYSIMO WATER PLANT\nNo. 6464\n[unclear handwriting]",
    supplierName: "HAYSIMO WATER PLANT",
    invoiceNumber: "6464",
    invoiceDate: null,
    subtotal: null,
    tax: null,
    discount: null,
    total: null,
    items: [],
  });
  assert.equal(result.invoiceDate, null);
  assert.throws(() => validateExtractedInvoice({ transcription: "", items: [] }), /no invoice transcription/i);
  assert.throws(() => validateExtractedInvoice({ transcription: "Invoice", items: [{}] }), /no description/i);
});

test("requires server-side OpenAI invoice configuration", () => {
  assert.throws(() => getOpenAIInvoiceConfig({}), /OPENAI_API_KEY and OPENAI_INVOICE_MODEL/);
  assert.deepEqual(
    getOpenAIInvoiceConfig({ OPENAI_API_KEY: " secret ", OPENAI_INVOICE_MODEL: " vision-model " }),
    { apiKey: "secret", model: "vision-model" },
  );
});

test("validates manager-entered invoice rows", () => {
  assert.deepEqual(
    validateInvoiceReviewRows([{
      description: " 500ml water ",
      target: "product:water-1",
      quantity: 5,
      unitPrice: 1.25,
      totalPrice: 6.25,
    }]),
    [{
      description: "500ml water",
      target: "product:water-1",
      kind: "product",
      targetId: "water-1",
      quantity: 5,
      unitPrice: 1.25,
      totalPrice: 6.25,
    }],
  );
});

test("rejects incomplete or unsafe invoice rows", () => {
  assert.throws(() => validateInvoiceReviewRows([]), /at least one invoice item/i);
  assert.throws(() => validateInvoiceReviewRows([{
    description: "Water",
    target: "product:water-1",
    quantity: 1.5,
    unitPrice: 1,
    totalPrice: 1.5,
  }]), /positive whole number/);
  assert.throws(() => validateInvoiceReviewRows([{
    description: "Water",
    target: "",
    quantity: 1,
    unitPrice: null,
    totalPrice: -1,
  }]), /inventory match/);
});
