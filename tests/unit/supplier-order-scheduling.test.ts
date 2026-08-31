import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  executeWithSupplierOrderSchedulerLease,
  SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS,
  SUPPLIER_ORDER_SCHEDULER_LEASE_KEY,
  type SchedulerLeaseClaim,
  type SchedulerLeaseOperations,
} from "../../src/lib/supplier-orders/scheduler-lease";
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

function inMemorySchedulerLease(clock: { now: number }) {
  let current:
    | { key: string; ownerToken: string; expiresAt: number }
    | undefined;
  const operations: SchedulerLeaseOperations = {
    async tryAcquire(claim: SchedulerLeaseClaim) {
      if (
        current?.key === claim.key &&
        current.expiresAt > clock.now
      ) {
        return false;
      }
      current = {
        key: claim.key,
        ownerToken: claim.ownerToken,
        expiresAt: clock.now + claim.leaseDurationMs,
      };
      return true;
    },
    async release({ key, ownerToken }) {
      if (current?.key === key && current.ownerToken === ownerToken) {
        current = undefined;
      }
    },
  };
  return { operations, current: () => current };
}

test("allows only one concurrent supplier-order scheduler execution", async () => {
  const clock = { now: 1_000 };
  const lease = inMemorySchedulerLease(clock);
  let startFirst!: () => void;
  let finishFirst!: () => void;
  const started = new Promise<void>((resolve) => {
    startFirst = resolve;
  });
  const blocker = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  let processed = 0;

  const first = executeWithSupplierOrderSchedulerLease({
    lease: lease.operations,
    createOwnerToken: () => "owner-one",
    process: async () => {
      processed += 1;
      startFirst();
      await blocker;
      return "first-result";
    },
  });
  await started;

  const overlapping = await executeWithSupplierOrderSchedulerLease({
    lease: lease.operations,
    createOwnerToken: () => "owner-two",
    process: async () => {
      processed += 1;
      return "duplicate-result";
    },
  });
  assert.deepEqual(overlapping, { alreadyRunning: true });
  assert.equal(processed, 1);

  finishFirst();
  assert.deepEqual(await first, {
    alreadyRunning: false,
    result: "first-result",
  });
  assert.equal(lease.current(), undefined);
});

test("recovers expired leases and releases only the current owner", async () => {
  const clock = { now: 5_000 };
  const lease = inMemorySchedulerLease(clock);
  const staleClaim = {
    key: SUPPLIER_ORDER_SCHEDULER_LEASE_KEY,
    ownerToken: "stale-owner",
    leaseDurationMs: SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS,
  };
  assert.equal(await lease.operations.tryAcquire(staleClaim), true);
  assert.equal(
    await lease.operations.tryAcquire({ ...staleClaim, ownerToken: "blocked" }),
    false,
  );

  clock.now += SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS;
  assert.equal(
    await lease.operations.tryAcquire({ ...staleClaim, ownerToken: "new-owner" }),
    true,
  );
  await lease.operations.release({
    key: staleClaim.key,
    ownerToken: "stale-owner",
  });
  assert.equal(lease.current()?.ownerToken, "new-owner");
  await lease.operations.release({
    key: staleClaim.key,
    ownerToken: "new-owner",
  });
  assert.equal(lease.current(), undefined);
});

test("releases the supplier-order scheduler lease after processor failure", async () => {
  const lease = inMemorySchedulerLease({ now: 10_000 });
  await assert.rejects(
    executeWithSupplierOrderSchedulerLease({
      lease: lease.operations,
      createOwnerToken: () => "failing-owner",
      process: async () => {
        throw new Error("processor failed");
      },
    }),
    /processor failed/,
  );
  assert.equal(lease.current(), undefined);
});

test("locks scheduler, Supabase HTTP, and Vercel duration configuration", () => {
  assert.equal(SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS, 180_000);

  const route = readFileSync(
    "src/app/api/cron/supplier-order-schedules/route.ts",
    "utf8",
  );
  assert.match(route, /export const maxDuration = 120;/);

  const setup = readFileSync(
    "ops/supabase/supplier-order-cron-setup.sql",
    "utf8",
  );
  assert.match(setup, /timeout_milliseconds := 135000/);
  assert.match(setup, /SECURITY INVOKER/);
  assert.match(setup, /SET search_path = ''/);
  assert.match(setup, /FROM vault\.decrypted_secrets/);
  assert.match(setup, /SELECT net\.http_get/);
  assert.match(setup, /REVOKE ALL ON SCHEMA private FROM PUBLIC/);
  assert.match(setup, /REVOKE ALL ON FUNCTION[\s\S]+FROM authenticated/);
  assert.doesNotMatch(setup, /cron\.schedule/);

  const activation = readFileSync(
    "ops/supabase/supplier-order-cron-activate.sql",
    "utf8",
  );
  assert.match(activation, /BEGIN;/);
  assert.match(activation, /supplier-order-scheduler-every-minute/);
  assert.match(activation, /supplier-order-scheduler-every-30-minutes/);
  assert.match(activation, /'\*\/30 \* \* \* \*'/);
  assert.doesNotMatch(activation, /'\* \* \* \* \*'/);
  assert.match(activation, /active := true/);
  assert.match(activation, /COMMIT;/);

  const disabling = readFileSync(
    "ops/supabase/supplier-order-cron-disable.sql",
    "utf8",
  );
  assert.match(disabling, /active := false/);
  assert.match(disabling, /supplier-order-scheduler-every-30-minutes/);
  assert.match(disabling, /supplier-order-scheduler-every-minute/);

  const workflow = readFileSync(
    ".github/workflows/supplier-order-scheduler.yml",
    "utf8",
  );
  assert.match(workflow, /cron: "\*\/30 \* \* \* \*"/);
  assert.doesNotMatch(workflow, /cron: "\*\/5 \* \* \* \*"/);
});

test("soft-deletes supplier-order schedules while preserving their audit history", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(
    schema,
    /model SupplierOrderSchedule \{[\s\S]*deletedAt\s+DateTime\?/,
  );

  const migration = readFileSync(
    "prisma/migrations/20260818_supplier_order_schedule_soft_delete/migration.sql",
    "utf8",
  );
  assert.match(migration, /ADD COLUMN "deletedAt" TIMESTAMP\(3\)/);

  const actions = readFileSync(
    "src/app/admin/supplier-order-schedules/actions.ts",
    "utf8",
  );
  assert.match(
    actions,
    /deleteSupplierOrderSchedule[\s\S]*requirePermission\(PERMISSIONS\.SUPPLIER_MANAGE\)/,
  );
  assert.match(
    actions,
    /deleteSupplierOrderSchedule[\s\S]*executeExclusiveSupplierOrderSchedulerOperation/,
  );
  assert.match(
    actions,
    /deletedAt,[\s\S]*isActive: false,[\s\S]*nextInviteAt: null,[\s\S]*nextSupplierSendAt: null/,
  );
  assert.match(
    actions,
    /status: \{ in: \["SCHEDULED", "COLLECTING", "FINALIZING"\] \}[\s\S]*status: "CANCELLED"/,
  );
  assert.doesNotMatch(actions, /supplierOrderSchedule\.delete\(/);
  assert.doesNotMatch(actions, /supplierOrderRun\.delete/);
  assert.doesNotMatch(actions, /supplierPurchaseOrder\.delete/);
  assert.doesNotMatch(actions, /supplierOrderWhatsAppDelivery\.delete/);

  const service = readFileSync(
    "src/lib/supplier-orders/service.ts",
    "utf8",
  );
  assert.ok(
    (service.match(/deletedAt: null/g)?.length ?? 0) >= 6,
    "every scheduler stage and the transactional claim must exclude deleted schedules",
  );

  const listPage = readFileSync(
    "src/app/admin/supplier-order-schedules/page.tsx",
    "utf8",
  );
  assert.match(listPage, /where: \{ deletedAt: null \}/);
  assert.match(listPage, /Schedule deleted/);

  const detailPage = readFileSync(
    "src/app/admin/supplier-order-schedules/\[id\]/page.tsx",
    "utf8",
  );
  assert.match(detailPage, /where: \{ id, deletedAt: null \}/);
  assert.match(detailPage, /DeleteScheduleButton/);

  const deleteButton = readFileSync(
    "src/app/admin/supplier-order-schedules/\[id\]/DeleteScheduleButton.tsx",
    "utf8",
  );
  assert.match(deleteButton, /AlertDialog/);
  assert.match(deleteButton, /variant="destructive"/);
  assert.match(deleteButton, /Existing purchase orders/);

  const requests = readFileSync(
    "src/lib/supplier-orders/requests.ts",
    "utf8",
  );
  assert.match(requests, /recipient\.run\.schedule\.deletedAt === null/);
  assert.match(requests, /recipient\.run\.schedule\.deletedAt !== null/);
});
