import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_ORDER_ITEM_NOTE_LENGTH,
  normalizeOrderItemNote,
  OrderItemNoteValidationError,
} from "../../src/lib/orders/order-item-notes";
import { normalizeKitchenTicket } from "../../src/lib/kitchen/kitchen-socket";

test("normalizes optional item instructions", () => {
  assert.equal(normalizeOrderItemNote(undefined), null);
  assert.equal(normalizeOrderItemNote("   "), null);
  assert.equal(normalizeOrderItemNote("  no sugar  "), "no sugar");
});

test("rejects non-text and oversized item instructions", () => {
  assert.throws(
    () => normalizeOrderItemNote({ instruction: "no sugar" }),
    OrderItemNoteValidationError,
  );
  assert.throws(
    () => normalizeOrderItemNote("x".repeat(MAX_ORDER_ITEM_NOTE_LENGTH + 1)),
    /cannot exceed 500 characters/,
  );
});

test("preserves item instructions when normalizing kitchen tickets", () => {
  const ticket = normalizeKitchenTicket({
    id: "ticket-1",
    orderId: "order-1",
    orderNumber: 1,
    ticketNumber: 1,
    roundNumber: 1,
    createdAt: new Date(0).toISOString(),
    status: "new",
    pickupStatus: "preparing",
    stationStatuses: { BARISTA: "new" },
    items: [
      {
        id: "line-1",
        name: "Tea",
        quantity: 1,
        station: "BARISTA",
        note: "  no sugar  ",
        modifiers: [],
      },
    ],
  });

  assert.equal(ticket?.items[0]?.note, "no sugar");
});

test("schema, APIs, cart, and kitchen display carry item instructions", async () => {
  const files = await Promise.all(
    [
      "../../prisma/schema.prisma",
      "../../src/app/api/orders/route.ts",
      "../../src/app/api/orders/complete-sale/route.ts",
      "../../src/app/api/orders/table/route.ts",
      "../../src/app/api/customer/orders/route.ts",
      "../../src/components/customer/CustomerCartSheet.tsx",
      "../../src/components/kitchen/KitchenTicketCard.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  assert.match(files[0], /notes\s+String\?\s+@db\.VarChar\(500\)/);
  for (const route of files.slice(1, 5)) {
    assert.match(route, /normalizeOrderItemNote\(item\.note\)/);
    assert.match(route, /notes: line\.notes/);
  }
  assert.match(files[5], /Special instructions for/);
  assert.match(files[6], /Item note:/);
});
