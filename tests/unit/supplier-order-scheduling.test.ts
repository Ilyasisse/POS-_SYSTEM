import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import twilio from "twilio";
import {
  assertWhatsAppPdfSize,
  derivePurchaseOrderPdfToken,
  MAX_WHATSAPP_PDF_BYTES,
  purchaseOrderPdfMediaPath,
  verifyPurchaseOrderPdfToken,
} from "../../src/lib/supplier-orders/pdf-access";
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
  extractTwilioStatusUpdate,
  isWhatsAppEnabled,
  readWhatsAppConfig,
  sendEmployeeOrderLink,
  sendSupplierPurchaseOrder,
  shouldApplyWhatsAppStatus,
  type TwilioMessageClient,
  verifyTwilioSignature,
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

test("verifies Twilio signatures and maps status callbacks", () => {
  const authToken = "twilio-auth-token";
  const url = "https://cafe.example.com/api/webhooks/whatsapp";
  const params = {
    MessageSid: "SM11111111111111111111111111111111",
    MessageStatus: "delivered",
  };
  const signature = twilio.getExpectedTwilioSignature(authToken, url, params);
  assert.equal(
    verifyTwilioSignature({ authToken, signatureHeader: signature, url, params }),
    true,
  );
  assert.equal(
    verifyTwilioSignature({ authToken, signatureHeader: "invalid", url, params }),
    false,
  );
  assert.deepEqual(extractTwilioStatusUpdate(params), {
    messageId: params.MessageSid,
    status: "delivered",
  });
  assert.deepEqual(
    extractTwilioStatusUpdate({
      MessageSid: "SM22222222222222222222222222222222",
      MessageStatus: "undelivered",
      ErrorCode: "63015",
      ChannelStatusMessage: "Recipient is not available",
    }),
    {
      messageId: "SM22222222222222222222222222222222",
      status: "failed",
      error: "Recipient is not available",
    },
  );
  assert.deepEqual(
    extractTwilioStatusUpdate({
      MessageSid: "SM33333333333333333333333333333333",
      MessageStatus: "delivered",
      EventType: "READ",
    }),
    {
      messageId: "SM33333333333333333333333333333333",
      status: "read",
    },
  );
});

test("ignores stale or regressive Twilio status updates", () => {
  assert.equal(shouldApplyWhatsAppStatus("PENDING", "ACCEPTED"), true);
  assert.equal(shouldApplyWhatsAppStatus("DELIVERED", "ACCEPTED"), false);
  assert.equal(shouldApplyWhatsAppStatus("READ", "FAILED"), false);
  assert.equal(shouldApplyWhatsAppStatus("FAILED", "DELIVERED"), false);
});

test("builds Twilio invitation and supplier Content API messages", async () => {
  const config = readWhatsAppConfig({
    NODE_ENV: "test" as const,
    TWILIO_ACCOUNT_SID: "AC11111111111111111111111111111111",
    TWILIO_API_KEY_SID: "SK11111111111111111111111111111111",
    TWILIO_API_KEY_SECRET: "api-key-secret",
    TWILIO_AUTH_TOKEN: "auth-token",
    TWILIO_WHATSAPP_FROM: "+15553269140",
    APP_BASE_URL: "https://cafe.example.com/",
    TWILIO_EMPLOYEE_INVITATION_CONTENT_SID:
      "HX11111111111111111111111111111111",
    TWILIO_EMPLOYEE_REMINDER_CONTENT_SID:
      "HX22222222222222222222222222222222",
    TWILIO_SUPPLIER_ORDER_CONTENT_SID:
      "HX33333333333333333333333333333333",
  });
  const calls: Parameters<TwilioMessageClient["messages"]["create"]>[0][] = [];
  const client: TwilioMessageClient = {
    messages: {
      async create(input) {
        calls.push(input);
        return { sid: `SM${String(calls.length).padStart(32, "0")}` };
      },
    },
  };
  const invitationId = await sendEmployeeOrderLink(
    {
      config,
      to: "+252612345678",
      employeeName: "Amina",
      supplierName: "Jasper Market",
      deadline: "Aug 10, 2026, 3:00 PM",
      token: "link-token",
      reminder: false,
    },
    client,
  );
  assert.equal(invitationId, "SM00000000000000000000000000000001");
  assert.equal(calls[0]?.from, "whatsapp:+15553269140");
  assert.equal(calls[0]?.to, "whatsapp:+252612345678");
  assert.equal(
    calls[0]?.contentSid,
    "HX11111111111111111111111111111111",
  );
  assert.deepEqual(JSON.parse(calls[0]?.contentVariables ?? "{}"), {
    "1": "Amina",
    "2": "Jasper Market",
    "3": "Aug 10, 2026, 3:00 PM",
    "4": "link-token",
  });
  assert.equal(
    calls[0]?.statusCallback,
    "https://cafe.example.com/api/webhooks/whatsapp",
  );

  const supplierMessageId = await sendSupplierPurchaseOrder(
    {
      config,
      to: "+252612345679",
      mediaPath: "delivery-id/token/purchase-order-101.pdf",
      orderNumber: 101,
      deliveryDate: "Aug 11, 2026",
      total: "$125.50",
    },
    client,
  );
  assert.equal(supplierMessageId, "SM00000000000000000000000000000002");
  assert.equal(
    calls[1]?.contentSid,
    "HX33333333333333333333333333333333",
  );
  assert.deepEqual(JSON.parse(calls[1]?.contentVariables ?? "{}"), {
    "1": "delivery-id/token/purchase-order-101.pdf",
    "2": "101",
    "3": "Aug 11, 2026",
    "4": "$125.50",
  });
});

test("gates WhatsApp processing and signs private PDF paths", () => {
  assert.equal(
    isWhatsAppEnabled({ NODE_ENV: "test", TWILIO_WHATSAPP_ENABLED: "true" }),
    true,
  );
  assert.equal(
    isWhatsAppEnabled({ NODE_ENV: "test", TWILIO_WHATSAPP_ENABLED: "false" }),
    false,
  );
  const env = {
    NODE_ENV: "test" as const,
    SUPPLIER_ORDER_PDF_LINK_SECRET:
      "a-different-pdf-link-secret-with-at-least-32-characters",
  };
  const filename = "purchase-order-101.pdf";
  const token = derivePurchaseOrderPdfToken("delivery-1", filename, env);
  assert.equal(
    verifyPurchaseOrderPdfToken("delivery-1", filename, token, env),
    true,
  );
  assert.equal(
    verifyPurchaseOrderPdfToken("delivery-2", filename, token, env),
    false,
  );
  assert.equal(
    purchaseOrderPdfMediaPath("delivery-1", 101, env),
    `delivery-1/${token}/${filename}`,
  );
  assert.doesNotThrow(() => assertWhatsAppPdfSize(new Uint8Array(100)));
  assert.throws(() =>
    assertWhatsAppPdfSize(new Uint8Array(MAX_WHATSAPP_PDF_BYTES + 1)),
  );
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
