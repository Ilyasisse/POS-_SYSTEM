import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { generatePurchaseOrderPdf } from "../../src/lib/supplier-orders/purchase-order-pdf";
import {
  advanceRecurringDate,
  aggregateResponseQuantities,
  deriveRecipientToken,
  expectedDeliveryDate,
  formatDateTimeLocal,
  hashRecipientToken,
  isSupplierOrderReminderDue,
  normalizeE164Phone,
  parseEmployeeResponse,
  zonedDateTimeToUtc,
} from "../../src/lib/supplier-orders/scheduling";
import {
  extractWhatsAppStatusUpdates,
  readWhatsAppConfig,
  sendEmployeeOrderLink,
  sendSupplierPurchaseOrder,
  uploadPurchaseOrderPdf,
  verifyWhatsAppSignature,
} from "../../src/lib/supplier-orders/whatsapp";

test("converts Nairobi wall-clock schedule values to UTC and back", () => {
  const value = zonedDateTimeToUtc("2026-08-10T09:30", "Africa/Nairobi");
  assert.equal(value?.toISOString(), "2026-08-10T06:30:00.000Z");
  assert.equal(
    formatDateTimeLocal(value as Date, "Africa/Nairobi"),
    "2026-08-10T09:30",
  );
  assert.equal(zonedDateTimeToUtc("not-a-date", "Africa/Nairobi"), null);
});

test("advances daily, weekly, and month-end recurrences in local time", () => {
  const start = zonedDateTimeToUtc("2026-01-31T09:00", "Africa/Nairobi") as Date;
  assert.equal(
    formatDateTimeLocal(
      advanceRecurringDate(start, "DAY", 2, "Africa/Nairobi") as Date,
      "Africa/Nairobi",
    ),
    "2026-02-02T09:00",
  );
  assert.equal(
    formatDateTimeLocal(
      advanceRecurringDate(start, "WEEK", 1, "Africa/Nairobi") as Date,
      "Africa/Nairobi",
    ),
    "2026-02-07T09:00",
  );
  assert.equal(
    formatDateTimeLocal(
      advanceRecurringDate(start, "MONTH", 1, "Africa/Nairobi") as Date,
      "Africa/Nairobi",
    ),
    "2026-02-28T09:00",
  );
});

test("normalizes E.164 numbers and creates deterministic unguessable tokens", () => {
  assert.equal(normalizeE164Phone("+252 61 234 5678"), "+252612345678");
  assert.equal(normalizeE164Phone("0612345678"), null);
  const secret = "a-secure-link-secret-that-is-longer-than-32-characters";
  const token = deriveRecipientToken("recipient-1", secret);
  assert.equal(token, deriveRecipientToken("recipient-1", secret));
  assert.notEqual(token, deriveRecipientToken("recipient-2", secret));
  assert.equal(hashRecipientToken(token).length, 64);
  assert.throws(() => deriveRecipientToken("recipient", "short"));
});

test("sends reminders only to pending invited employees before the deadline", () => {
  const base = {
    status: "PENDING" as const,
    invitedAt: new Date("2026-08-10T06:00:00Z"),
    lastReminderAt: null,
    reminderIntervalMinutes: 60,
    deadline: new Date("2026-08-10T12:00:00Z"),
    now: new Date("2026-08-10T07:00:00Z"),
  };
  assert.equal(isSupplierOrderReminderDue(base), true);
  assert.equal(
    isSupplierOrderReminderDue({ ...base, status: "RESPONDED" }),
    false,
  );
  assert.equal(
    isSupplierOrderReminderDue({ ...base, now: base.deadline }),
    false,
  );
  assert.equal(
    isSupplierOrderReminderDue({
      ...base,
      lastReminderAt: new Date("2026-08-10T06:30:00Z"),
    }),
    false,
  );
});

test("validates employee item/no-order payloads and aggregates quantities", () => {
  const response = parseEmployeeResponse({
    noOrder: false,
    items: [
      { catalogItemId: "coffee", quantity: "1.25" },
      { catalogItemId: "milk", quantity: "2" },
    ],
  });
  assert.equal(response.noOrder, false);
  assert.deepEqual(parseEmployeeResponse({ noOrder: true, items: [] }), {
    noOrder: true,
    items: [],
  });
  assert.throws(() =>
    parseEmployeeResponse({
      noOrder: false,
      items: [
        { catalogItemId: "coffee", quantity: "1" },
        { catalogItemId: "coffee", quantity: "2" },
      ],
    }),
  );
  const totals = aggregateResponseQuantities([
    { catalogItemId: "coffee", quantity: "1.25" },
    { catalogItemId: "coffee", quantity: "2.75" },
  ]);
  assert.equal(totals.get("coffee")?.toString(), "4");
});

test("calculates expected delivery from the schedule local date", () => {
  const lateNairobi = new Date("2026-08-10T22:30:00.000Z");
  assert.equal(
    expectedDeliveryDate(lateNairobi, 1, "Africa/Nairobi").toISOString(),
    "2026-08-12T00:00:00.000Z",
  );
});

test("verifies Meta webhook signatures and extracts delivery updates", () => {
  const body = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [
                { id: "wamid-1", status: "delivered" },
                {
                  id: "wamid-2",
                  status: "failed",
                  errors: [{ message: "Undeliverable" }],
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const secret = "meta-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyWhatsAppSignature(body, `sha256=${signature}`, secret), true);
  assert.equal(verifyWhatsAppSignature(body, "sha256=deadbeef", secret), false);
  assert.deepEqual(extractWhatsAppStatusUpdates(JSON.parse(body)), [
    { messageId: "wamid-1", status: "delivered", error: undefined },
    { messageId: "wamid-2", status: "failed", error: "Undeliverable" },
  ]);
});

test("builds Meta invitation, media, and supplier template requests", { concurrency: false }, async () => {
  const config = readWhatsAppConfig({
    NODE_ENV: "test",
    WHATSAPP_GRAPH_API_VERSION: "v23.0",
    WHATSAPP_ACCESS_TOKEN: "token",
    WHATSAPP_PHONE_NUMBER_ID: "phone-id",
    WHATSAPP_BUSINESS_ACCOUNT_ID: "business-id",
    WHATSAPP_APP_SECRET: "app-secret",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify",
    APP_BASE_URL: "https://cafe.example.com/",
    WHATSAPP_TEMPLATE_LANGUAGE: "en_US",
    WHATSAPP_EMPLOYEE_INVITATION_TEMPLATE: "employee_invite",
    WHATSAPP_EMPLOYEE_REMINDER_TEMPLATE: "employee_reminder",
    WHATSAPP_SUPPLIER_ORDER_TEMPLATE: "supplier_order",
  });
  const calls: { url: string; init?: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return Response.json(
      url.endsWith("/media") ? { id: "media-1" } : { messages: [{ id: `wamid-${calls.length}` }] },
    );
  }) as typeof fetch;
  try {
    const invitationId = await sendEmployeeOrderLink({
      config,
      to: "+252612345678",
      employeeName: "Amina",
      supplierName: "Jasper Market",
      deadline: "Aug 10, 2026, 3:00 PM",
      token: "link-token",
      reminder: false,
    });
    assert.equal(invitationId, "wamid-1");
    const invitation = JSON.parse(String(calls[0]?.init?.body));
    assert.equal(invitation.to, "252612345678");
    assert.equal(invitation.template.name, "employee_invite");
    assert.equal(
      invitation.template.components[1].parameters[0].text,
      "link-token",
    );

    const mediaId = await uploadPurchaseOrderPdf(
      config,
      new Uint8Array([37, 80, 68, 70]),
      "purchase-order-101.pdf",
    );
    assert.equal(mediaId, "media-1");
    assert.ok(calls[1]?.init?.body instanceof FormData);

    const supplierMessageId = await sendSupplierPurchaseOrder({
      config,
      to: "+252612345679",
      mediaId,
      filename: "purchase-order-101.pdf",
      orderNumber: 101,
      deliveryDate: "Aug 11, 2026",
      total: "$125.50",
    });
    assert.equal(supplierMessageId, "wamid-3");
    const supplier = JSON.parse(String(calls[2]?.init?.body));
    assert.equal(supplier.template.name, "supplier_order");
    assert.equal(
      supplier.template.components[0].parameters[0].document.id,
      "media-1",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generates valid one-page and multi-page purchase-order PDFs", async () => {
  const base = {
    orderNumber: 101,
    status: "OPEN",
    supplierName: "Jasper Market Supplies",
    supplierContact: "Jessica",
    supplierPhone: "+252612345678",
    createdAt: new Date("2026-08-10T00:00:00Z"),
    expectedDeliveryDate: new Date("2026-08-11T00:00:00Z"),
    preparedBy: "Cafe Admin",
    notes: "Deliver to the rear entrance.",
    totalAmount: "125.50",
  };
  const item = {
    name: "Premium roasted coffee beans",
    unit: "bag",
    quantity: "2",
    unitPrice: "20.00",
    lineTotal: "40.00",
  };
  const onePage = await generatePurchaseOrderPdf({ ...base, items: [item] });
  assert.equal(Buffer.from(onePage).subarray(0, 4).toString(), "%PDF");
  assert.equal((await PDFDocument.load(onePage)).getPageCount(), 1);
  const multiPage = await generatePurchaseOrderPdf({
    ...base,
    items: Array.from({ length: 45 }, (_, index) => ({
      ...item,
      name: `${item.name} ${index + 1}`,
    })),
  });
  assert.ok((await PDFDocument.load(multiPage)).getPageCount() > 1);
});
