import { expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";

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
  expect(value?.toISOString()).toBe("2026-08-10T06:30:00.000Z");
  expect(formatDateTimeLocal(value as Date, "Africa/Nairobi")).toBe("2026-08-10T09:30");
  expect(zonedDateTimeToUtc("not-a-date", "Africa/Nairobi")).toBe(null);
});

test("advances daily, weekly, and month-end recurrences in local time", () => {
  const start = zonedDateTimeToUtc("2026-01-31T09:00", "Africa/Nairobi") as Date;
  expect(
    formatDateTimeLocal(
      advanceRecurringDate(start, "DAY", 2, "Africa/Nairobi") as Date,
      "Africa/Nairobi",
    ),
  ).toBe("2026-02-02T09:00");
  expect(
    formatDateTimeLocal(
      advanceRecurringDate(start, "WEEK", 1, "Africa/Nairobi") as Date,
      "Africa/Nairobi",
    ),
  ).toBe("2026-02-07T09:00");
  expect(
    formatDateTimeLocal(
      advanceRecurringDate(start, "MONTH", 1, "Africa/Nairobi") as Date,
      "Africa/Nairobi",
    ),
  ).toBe("2026-02-28T09:00");
});

test("normalizes E.164 numbers and creates deterministic unguessable tokens", () => {
  expect(normalizeE164Phone("+252 61 234 5678")).toBe("+252612345678");
  expect(normalizeE164Phone("0612345678")).toBe(null);
  const secret = "a-secure-link-secret-that-is-longer-than-32-characters";
  const token = deriveRecipientToken("recipient-1", secret);
  expect(token).toBe(deriveRecipientToken("recipient-1", secret));
  expect(token).not.toBe(deriveRecipientToken("recipient-2", secret));
  expect(hashRecipientToken(token).length).toBe(64);
  expect(() => deriveRecipientToken("recipient", "short")).toThrow();
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
  expect(isSupplierOrderReminderDue(base)).toBe(true);
  expect(isSupplierOrderReminderDue({ ...base, status: "RESPONDED" })).toBe(false);
  expect(isSupplierOrderReminderDue({ ...base, now: base.deadline })).toBe(false);
  expect(
    isSupplierOrderReminderDue({
      ...base,
      lastReminderAt: new Date("2026-08-10T06:30:00Z"),
    }),
  ).toBe(false);
});

test("validates employee item/no-order payloads and aggregates quantities", () => {
  const response = parseEmployeeResponse({
    noOrder: false,
    items: [
      { catalogItemId: "coffee", quantity: "1.25" },
      { catalogItemId: "milk", quantity: "2" },
    ],
  });
  expect(response.noOrder).toBe(false);
  expect(parseEmployeeResponse({ noOrder: true, items: [] })).toStrictEqual({
    noOrder: true,
    items: [],
  });
  expect(() =>
    parseEmployeeResponse({
      noOrder: false,
      items: [
        { catalogItemId: "coffee", quantity: "1" },
        { catalogItemId: "coffee", quantity: "2" },
      ],
    }),
  ).toThrow();
  const totals = aggregateResponseQuantities([
    { catalogItemId: "coffee", quantity: "1.25" },
    { catalogItemId: "coffee", quantity: "2.75" },
  ]);
  expect(totals.get("coffee")?.toString()).toBe("4");
});

test("calculates expected delivery from the schedule local date", () => {
  const lateNairobi = new Date("2026-08-10T22:30:00.000Z");
  expect(expectedDeliveryDate(lateNairobi, 1, "Africa/Nairobi").toISOString()).toBe(
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
  expect(
    verifyTwilioSignature({
      authToken,
      signatureHeader: signature,
      url,
      params,
    }),
  ).toBe(true);
  expect(
    verifyTwilioSignature({
      authToken,
      signatureHeader: "invalid",
      url,
      params,
    }),
  ).toBe(false);
  expect(extractTwilioStatusUpdate(params)).toStrictEqual({
    messageId: params.MessageSid,
    status: "delivered",
  });
  expect(
    extractTwilioStatusUpdate({
      MessageSid: "SM22222222222222222222222222222222",
      MessageStatus: "undelivered",
      ErrorCode: "63015",
      ChannelStatusMessage: "Recipient is not available",
    }),
  ).toStrictEqual({
    messageId: "SM22222222222222222222222222222222",
    status: "failed",
    error: "Recipient is not available",
  });
  expect(
    extractTwilioStatusUpdate({
      MessageSid: "SM33333333333333333333333333333333",
      MessageStatus: "delivered",
      EventType: "READ",
    }),
  ).toStrictEqual({
    messageId: "SM33333333333333333333333333333333",
    status: "read",
  });
});

test("ignores stale or regressive Twilio status updates", () => {
  expect(shouldApplyWhatsAppStatus("PENDING", "ACCEPTED")).toBe(true);
  expect(shouldApplyWhatsAppStatus("DELIVERED", "ACCEPTED")).toBe(false);
  expect(shouldApplyWhatsAppStatus("READ", "FAILED")).toBe(false);
  expect(shouldApplyWhatsAppStatus("FAILED", "DELIVERED")).toBe(false);
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
    TWILIO_EMPLOYEE_INVITATION_CONTENT_SID: "HX11111111111111111111111111111111",
    TWILIO_EMPLOYEE_REMINDER_CONTENT_SID: "HX22222222222222222222222222222222",
    TWILIO_SUPPLIER_ORDER_CONTENT_SID: "HX33333333333333333333333333333333",
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
  expect(invitationId).toBe("SM00000000000000000000000000000001");
  expect(calls[0]?.from).toBe("whatsapp:+15553269140");
  expect(calls[0]?.to).toBe("whatsapp:+252612345678");
  expect(calls[0]?.contentSid).toBe("HX11111111111111111111111111111111");
  expect(JSON.parse(calls[0]?.contentVariables ?? "{}")).toStrictEqual({
    "1": "Amina",
    "2": "Jasper Market",
    "3": "Aug 10, 2026, 3:00 PM",
    "4": "link-token",
  });
  expect(calls[0]?.statusCallback).toBe("https://cafe.example.com/api/webhooks/whatsapp");

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
  expect(supplierMessageId).toBe("SM00000000000000000000000000000002");
  expect(calls[1]?.contentSid).toBe("HX33333333333333333333333333333333");
  expect(JSON.parse(calls[1]?.contentVariables ?? "{}")).toStrictEqual({
    "1": "delivery-id/token/purchase-order-101.pdf",
    "2": "101",
    "3": "Aug 11, 2026",
    "4": "$125.50",
  });
});

test("gates WhatsApp processing and signs private PDF paths", () => {
  expect(isWhatsAppEnabled({ NODE_ENV: "test", TWILIO_WHATSAPP_ENABLED: "true" })).toBe(true);
  expect(isWhatsAppEnabled({ NODE_ENV: "test", TWILIO_WHATSAPP_ENABLED: "false" })).toBe(false);
  const env = {
    NODE_ENV: "test" as const,
    SUPPLIER_ORDER_PDF_LINK_SECRET: "a-different-pdf-link-secret-with-at-least-32-characters",
  };
  const filename = "purchase-order-101.pdf";
  const token = derivePurchaseOrderPdfToken("delivery-1", filename, env);
  expect(verifyPurchaseOrderPdfToken("delivery-1", filename, token, env)).toBe(true);
  expect(verifyPurchaseOrderPdfToken("delivery-2", filename, token, env)).toBe(false);
  expect(purchaseOrderPdfMediaPath("delivery-1", 101, env)).toBe(`delivery-1/${token}/${filename}`);
  expect(() => assertWhatsAppPdfSize(new Uint8Array(100))).not.toThrow();
  expect(() => assertWhatsAppPdfSize(new Uint8Array(MAX_WHATSAPP_PDF_BYTES + 1))).toThrow();
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
  expect(Buffer.from(onePage).subarray(0, 4).toString()).toBe("%PDF");
  expect((await PDFDocument.load(onePage)).getPageCount()).toBe(1);
  const multiPage = await generatePurchaseOrderPdf({
    ...base,
    items: Array.from({ length: 45 }, (_, index) => ({
      ...item,
      name: `${item.name} ${index + 1}`,
    })),
  });
  expect((await PDFDocument.load(multiPage)).getPageCount() > 1).toBeTruthy();
});

function inMemorySchedulerLease(clock: { now: number }) {
  let current: { key: string; ownerToken: string; expiresAt: number } | undefined;
  const operations: SchedulerLeaseOperations = {
    async tryAcquire(claim: SchedulerLeaseClaim) {
      if (current?.key === claim.key && current.expiresAt > clock.now) {
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
  expect(overlapping).toStrictEqual({ alreadyRunning: true });
  expect(processed).toBe(1);

  finishFirst();
  expect(await first).toStrictEqual({
    alreadyRunning: false,
    result: "first-result",
  });
  expect(lease.current()).toBe(undefined);
});

test("recovers expired leases and releases only the current owner", async () => {
  const clock = { now: 5_000 };
  const lease = inMemorySchedulerLease(clock);
  const staleClaim = {
    key: SUPPLIER_ORDER_SCHEDULER_LEASE_KEY,
    ownerToken: "stale-owner",
    leaseDurationMs: SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS,
  };
  expect(await lease.operations.tryAcquire(staleClaim)).toBe(true);
  expect(await lease.operations.tryAcquire({ ...staleClaim, ownerToken: "blocked" })).toBe(false);

  clock.now += SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS;
  expect(
    await lease.operations.tryAcquire({
      ...staleClaim,
      ownerToken: "new-owner",
    }),
  ).toBe(true);
  await lease.operations.release({
    key: staleClaim.key,
    ownerToken: "stale-owner",
  });
  expect(lease.current()?.ownerToken).toBe("new-owner");
  await lease.operations.release({
    key: staleClaim.key,
    ownerToken: "new-owner",
  });
  expect(lease.current()).toBe(undefined);
});

test("releases the supplier-order scheduler lease after processor failure", async () => {
  const lease = inMemorySchedulerLease({ now: 10_000 });
  await expect(
    executeWithSupplierOrderSchedulerLease({
      lease: lease.operations,
      createOwnerToken: () => "failing-owner",
      process: async () => {
        throw new Error("processor failed");
      },
    }),
  ).rejects.toThrow(/processor failed/);
  expect(lease.current()).toBe(undefined);
});

test("locks scheduler, Supabase HTTP, and Vercel duration configuration", () => {
  expect(SUPPLIER_ORDER_SCHEDULER_LEASE_DURATION_MS).toBe(180_000);

  const route = readFileSync("src/app/api/cron/supplier-order-schedules/route.ts", "utf8");
  expect(route).toMatch(/export const maxDuration = 120;/);

  const setup = readFileSync("ops/supabase/supplier-order-cron-setup.sql", "utf8");
  expect(setup).toMatch(/timeout_milliseconds := 135000/);
  expect(setup).toMatch(/SECURITY INVOKER/);
  expect(setup).toMatch(/SET search_path = ''/);
  expect(setup).toMatch(/FROM vault\.decrypted_secrets/);
  expect(setup).toMatch(/SELECT net\.http_get/);
  expect(setup).toMatch(/REVOKE ALL ON SCHEMA private FROM PUBLIC/);
  expect(setup).toMatch(/REVOKE ALL ON FUNCTION[\s\S]+FROM authenticated/);
  expect(setup).not.toMatch(/cron\.schedule/);

  const activation = readFileSync("ops/supabase/supplier-order-cron-activate.sql", "utf8");
  expect(activation).toMatch(/BEGIN;/);
  expect(activation).toMatch(/supplier-order-scheduler-every-minute/);
  expect(activation).toMatch(/supplier-order-scheduler-every-30-minutes/);
  expect(activation).toMatch(/'\*\/30 \* \* \* \*'/);
  expect(activation).not.toMatch(/'\* \* \* \* \*'/);
  expect(activation).toMatch(/active := true/);
  expect(activation).toMatch(/COMMIT;/);

  const disabling = readFileSync("ops/supabase/supplier-order-cron-disable.sql", "utf8");
  expect(disabling).toMatch(/active := false/);
  expect(disabling).toMatch(/supplier-order-scheduler-every-30-minutes/);
  expect(disabling).toMatch(/supplier-order-scheduler-every-minute/);

  const workflow = readFileSync(".github/workflows/supplier-order-scheduler.yml", "utf8");
  expect(workflow).toMatch(/cron: "\*\/30 \* \* \* \*"/);
  expect(workflow).not.toMatch(/cron: "\*\/5 \* \* \* \*"/);
});

test("soft-deletes supplier-order schedules while preserving their audit history", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  expect(schema).toMatch(/model SupplierOrderSchedule \{[\s\S]*deletedAt\s+DateTime\?/);

  const migration = readFileSync(
    "prisma/migrations/20260818_supplier_order_schedule_soft_delete/migration.sql",
    "utf8",
  );
  expect(migration).toMatch(/ADD COLUMN "deletedAt" TIMESTAMP\(3\)/);

  const actions = readFileSync(
    "src/app/admin/(suppliers)/supplier-order-schedules/actions.ts",
    "utf8",
  );
  expect(actions).toMatch(
    /deleteSupplierOrderSchedule[\s\S]*requirePermission\(PERMISSIONS\.SUPPLIER_MANAGE\)/,
  );
  expect(actions).toMatch(
    /deleteSupplierOrderSchedule[\s\S]*executeExclusiveSupplierOrderSchedulerOperation/,
  );
  expect(actions).toMatch(
    /deletedAt,[\s\S]*isActive: false,[\s\S]*nextInviteAt: null,[\s\S]*nextSupplierSendAt: null/,
  );
  expect(actions).toMatch(
    /status: \{ in: \["SCHEDULED", "COLLECTING", "FINALIZING"\] \}[\s\S]*status: "CANCELLED"/,
  );
  expect(actions).not.toMatch(/supplierOrderSchedule\.delete\(/);
  expect(actions).not.toMatch(/supplierOrderRun\.delete/);
  expect(actions).not.toMatch(/supplierPurchaseOrder\.delete/);
  expect(actions).not.toMatch(/supplierOrderWhatsAppDelivery\.delete/);

  const service = readFileSync("src/lib/supplier-orders/service.ts", "utf8");
  expect({
    context: "every scheduler stage and the transactional claim must exclude deleted schedules",
    value: Boolean((service.match(/deletedAt: null/g)?.length ?? 0) >= 6),
  }).toStrictEqual({
    context: "every scheduler stage and the transactional claim must exclude deleted schedules",
    value: true,
  });

  const listPage = readFileSync(
    "src/app/admin/(suppliers)/supplier-order-schedules/page.tsx",
    "utf8",
  );
  expect(listPage).toMatch(/where: \{ deletedAt: null \}/);
  expect(listPage).toMatch(/Schedule deleted/);

  const detailPage = readFileSync(
    "src/app/admin/(suppliers)/supplier-order-schedules/\[id\]/page.tsx",
    "utf8",
  );
  expect(detailPage).toMatch(/where: \{ id, deletedAt: null \}/);
  expect(detailPage).toMatch(/DeleteScheduleButton/);

  const deleteButton = readFileSync(
    "src/app/admin/(suppliers)/supplier-order-schedules/\[id\]/DeleteScheduleButton.tsx",
    "utf8",
  );
  expect(deleteButton).toMatch(/AlertDialog/);
  expect(deleteButton).toMatch(/variant="destructive"/);
  expect(deleteButton).toMatch(/Existing purchase orders/);

  const requests = readFileSync("src/lib/supplier-orders/requests.ts", "utf8");
  expect(requests).toMatch(/recipient\.run\.schedule\.deletedAt === null/);
  expect(requests).toMatch(/recipient\.run\.schedule\.deletedAt !== null/);
});
