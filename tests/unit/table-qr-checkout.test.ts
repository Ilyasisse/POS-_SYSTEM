import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  createTableQrToken,
  verifyTableQrToken,
} from "../../src/lib/customer-orders/table-qr-token";
import { normalizeCustomerPaymentPhone } from "../../src/lib/payments/customer-ussd";

const secret = "test-only-table-qr-secret-with-32-characters";
const token = createTableQrToken("signed-table", 1, secret);
type Row = Record<string, unknown>;
type Response = { status: number; body: { checkout?: Row } };
type Server = {
  POST(request: Request): Promise<Response>;
  finalizeCustomerCheckout(id: string): Promise<Row | null>;
};

function loadServer(
  path: string,
  dependencies: Record<string, unknown>,
): Server {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    Date,
    crypto: { randomUUID },
    console: { error() {} },
  });
  return exports as Server;
}

class Decimal {
  constructor(private value: number) {}
  valueOf() {
    return this.value;
  }
}
const prismaTypes = {
  Prisma: { Decimal, PrismaClientKnownRequestError: class extends Error {} },
  CustomerCheckoutStatus: Object.fromEntries(
    [
      "PENDING",
      "REVIEW",
      "EXPIRED",
      "PAYMENT_RECEIVED",
      "NEEDS_HELP",
      "PAID",
    ].map((status) => [status, status]),
  ),
  MobileMoneyReceiptStatus: { ASSIGNED: "ASSIGNED" },
};

function checkoutFixture(
  options: {
    role?: string;
    enabled?: boolean;
    active?: boolean;
    version?: number;
    revokedWhilePreparing?: boolean;
    existing?: Row;
    station?: string;
  } = {},
) {
  const writes: Row[] = [];
  const locks: string[] = [];
  let tableReads = 0;
  const table = {
    id: "signed-table",
    isActive: options.active ?? true,
    qrOrderingEnabled: options.enabled ?? true,
    qrTokenVersion: options.version ?? 1,
  };
  const db = {
    $queryRaw: async (parts: TemplateStringsArray) => {
      locks.push(parts.join("?"));
      return [];
    },
    table: {
      findFirst: async ({ where }: { where: Row }) => {
        tableReads++;
        return where.id === table.id &&
          table.isActive &&
          (where.qrTokenVersion === undefined ||
            (table.qrOrderingEnabled &&
              where.qrTokenVersion === table.qrTokenVersion))
          ? table
          : null;
      },
      findUnique: async () =>
        options.revokedWhilePreparing ? { ...table, qrTokenVersion: 2 } : table,
    },
    product: {
      findMany: async () => [
        {
          id: "tea",
          name: "Tea",
          price: 2,
          cost: null,
          recipeVersions: [],
          category: { station: options.station ?? "KITCHEN" },
        },
      ],
    },
    staff: { findMany: async () => [{ id: "barista-1", fullName: "Amina" }] },
    customerCheckout: {
      findUnique: async () => options.existing ?? null,
      create: async ({ data }: { data: Row }) => {
        writes.push(data);
        return { id: "checkout-1", status: "PENDING", ...data };
      },
    },
  };
  const server = loadServer("src/app/api/customer/checkouts/route.ts", {
    "next/server": {
      NextResponse: {
        json: (body: Response["body"], options?: { status?: number }) => ({
          body,
          status: options?.status ?? 200,
        }),
      },
    },
    "@prisma/client": prismaTypes,
    "@/lib/prisma": {
      prisma: {
        ...db,
        $transaction: async (run: (tx: typeof db) => Promise<unknown>) =>
          run(db),
      },
    },
    "@/lib/auth/api-authorization": {
      authorizeApi: async () => ({
        ok: true,
        user: {
          id: "customer-1",
          role: options.role ?? "CUSTOMER",
          fullName: "Customer",
        },
      }),
    },
    "@/lib/auth/permissions": { PERMISSIONS: {} },
    "@/lib/payments/customer-ussd": { normalizeCustomerPaymentPhone },
    "@/lib/customer-orders/table-qr-token": {
      verifyTableQrToken: (value: string) => verifyTableQrToken(value, secret),
    },
    "@/lib/inventory/inventory-domain": {
      selectEffectiveRecipe: () => null,
      snapshotInventoryCost: () => ({
        unitCostSnapshot: null,
        costSnapshotSource: null,
        recipeVersionId: null,
      }),
    },
  });
  return {
    writes,
    locks,
    tableReads: () => tableReads,
    post: (changes: Row = {}) =>
      server.POST(
        new Request("https://example.test/api/customer/checkouts", {
          method: "POST",
          body: JSON.stringify({
            customerName: "Customer",
            paymentPhone: "901234567",
            idempotencyKey: randomUUID(),
            orderType: "TAKEOUT",
            tableId: "spoofed-table",
            tableToken: token,
            items: [{ productId: "tea", qty: 2 }],
            ...changes,
          }),
        }),
      ),
  };
}

test("a signed table code binds checkout destination under a table row lock", async () => {
  const fixture = checkoutFixture();
  assert.equal((await fixture.post()).status, 201);
  assert.equal(fixture.writes[0].tableId, "signed-table");
  assert.equal(fixture.writes[0].orderType, "DINE_IN");
  assert.equal(Number(fixture.writes[0].amount), 4);
  assert.match(fixture.locks[0], /Table.*FOR UPDATE/);
});

test("tampered, disabled, rotated, inactive and concurrently revoked codes create no checkout", async () => {
  for (const options of [
    { enabled: false },
    { active: false },
    { version: 2 },
    { revokedWhilePreparing: true },
  ]) {
    const fixture = checkoutFixture(options);
    assert.equal((await fixture.post()).status, 403);
    assert.equal(fixture.writes.length, 0);
  }
  const tampered = checkoutFixture();
  assert.equal((await tampered.post({ tableToken: `${token}x` })).status, 403);
  assert.equal(tampered.writes.length, 0);
});

test("QR orders use active Staff baristas and retain customer sign-in and payer validation", async () => {
  const drink = checkoutFixture({ station: "BARISTA" });
  assert.equal((await drink.post()).status, 201);
  assert.equal(
    (drink.writes[0].snapshot as Row[])[0].assignedBaristaId,
    "barista-1",
  );
  const staff = checkoutFixture({ role: "WAITER" });
  assert.equal((await staff.post()).status, 403);
  assert.equal(staff.writes.length, 0);
  const badPhone = checkoutFixture();
  assert.equal(
    (await badPhone.post({ paymentPhone: "+252901234567" })).status,
    400,
  );
  assert.equal(badPhone.writes.length, 0);
});

test("ordinary pickup checkout remains available without a QR code", async () => {
  const fixture = checkoutFixture();
  assert.equal((await fixture.post({ tableToken: undefined })).status, 201);
  assert.equal(fixture.writes[0].orderType, "TAKEOUT");
  assert.equal(fixture.writes[0].tableId, null);
  assert.equal(fixture.locks.length, 0);
});

test("owned idempotent checkout recovers after code rotation; another customer cannot recover it", async () => {
  const existing = {
    id: "original",
    customerId: "customer-1",
    amount: 4,
    status: "PENDING",
  };
  const owned = checkoutFixture({ existing, version: 2 });
  const response = await owned.post();
  assert.equal(response.status, 200);
  assert.equal(response.body.checkout?.id, "original");
  assert.equal(owned.writes.length, 0);
  assert.equal(owned.tableReads(), 0);
  const other = checkoutFixture({
    existing: { ...existing, customerId: "other" },
  });
  assert.equal((await other.post()).status, 409);
  assert.equal(other.writes.length, 0);
});

function settlementFixture(amount = 4) {
  const checkout = {
    id: "checkout-1",
    customerId: "customer-1",
    customerName: "Customer",
    payerPhone: "252901234567",
    orderType: "DINE_IN",
    tableId: "signed-table",
    amount: 4,
    status: "PAYMENT_RECEIVED",
    receiptId: "receipt-1",
    snapshot: [
      {
        productId: "tea",
        productName: "Tea",
        qty: 2,
        station: "KITCHEN",
        assignedBaristaId: null,
        assignedBaristaName: null,
        unitPrice: 2,
        lineTotal: 4,
        modifiers: [],
        costSnapshot: {
          unitCostSnapshot: null,
          costSnapshotSource: null,
          recipeVersionId: null,
        },
      },
    ],
  };
  const orders: Row[] = [];
  const payments: Row[] = [];
  const db = {
    $queryRaw: async () => [],
    customerCheckout: {
      findUnique: async () => checkout,
      update: async ({ data }: { data: Row }) => {
        Object.assign(checkout, data);
        return checkout;
      },
      updateMany: async ({ data }: { data: Row }) => {
        Object.assign(checkout, data);
        return { count: 1 };
      },
    },
    mobileMoneyReceipt: {
      findUnique: async () => ({
        id: "receipt-1",
        amount,
        status: "ASSIGNED",
        providerReference: "payment-ref",
      }),
    },
    table: {
      findUnique: async () => ({
        name: "Table One",
        qrOrderingEnabled: false,
        qrTokenVersion: 99,
      }),
    },
    order: {
      create: async ({ data }: { data: Row }) => {
        const order = { id: "order-1", orderNumber: 17, ...data };
        orders.push(order);
        return order;
      },
    },
    orderItem: { createMany: async () => ({ count: 1 }) },
    payment: {
      create: async ({ data }: { data: Row }) => {
        payments.push(data);
        return data;
      },
    },
  };
  const server = loadServer("src/lib/payments/customer-checkout.ts", {
    "@prisma/client": prismaTypes,
    "@/lib/prisma": {
      prisma: {
        ...db,
        $transaction: async (run: (tx: typeof db) => Promise<unknown>) =>
          run(db),
      },
    },
    "@/lib/customer-orders/table-qr-token": {
      verifyTableQrToken: () => {
        throw new Error("QR secret rotated");
      },
    },
    "@/lib/kitchen/kitchen-tickets": {
      createKitchenTicketState: async () => {},
    },
    "@/lib/inventory/inventory": {
      deductProductInventoryForSale: async () => [],
      sendInventoryAlerts: async () => {},
    },
    "@/lib/staff/customer-order-dispatch": {
      dispatchCustomerOrder: async () => {},
    },
    "@/lib/posthog-server": { getPostHogClient: () => null },
  });
  return {
    checkout,
    orders,
    payments,
    finalize: () => server.finalizeCustomerCheckout(checkout.id),
  };
}

test("verified payment settles its saved table once after QR revocation", async () => {
  const fixture = settlementFixture();
  assert.equal((await fixture.finalize())?.tableId, "signed-table");
  assert.equal(fixture.checkout.status, "PAID");
  assert.equal(await fixture.finalize(), null);
  assert.equal(fixture.orders.length, 1);
  assert.equal(fixture.payments.length, 1);
  assert.equal(fixture.payments[0].mobileMoneyReceiptId, "receipt-1");
});

test("mismatched payment amount retains the receipt for staff help without creating an order", async () => {
  const fixture = settlementFixture(5);
  assert.equal(await fixture.finalize(), null);
  assert.equal(fixture.checkout.status, "NEEDS_HELP");
  assert.equal(fixture.checkout.receiptId, "receipt-1");
  assert.equal(fixture.orders.length, 0);
  assert.equal(fixture.payments.length, 0);
});
