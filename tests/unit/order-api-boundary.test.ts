/* eslint-disable @typescript-eslint/no-explicit-any -- isolated adapters execute actual transpiled API modules. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as client from "@prisma/client";

function loadModule(path: string, dependencies: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => {
      if (!(name in dependencies)) {
        throw new Error(`Missing isolated dependency: ${name}`);
      }
      return dependencies[name];
    },
    Date,
    Error,
    SyntaxError,
    crypto: { randomUUID },
    console: { error: () => {}, warn: () => {} },
    process,
  });
  return exports;
}

const permissions = loadModule("src/lib/auth/permissions.ts", {});
const availability = loadModule("src/lib/products/availability.ts", {});
const input = loadModule("src/lib/sales/order-input.ts", {});
const postCommit = loadModule("src/lib/sales/order-postcommit.ts", {});
const routePaths = {
  sale: "src/app/api/orders/route.ts",
  completeSale: "src/app/api/orders/complete-sale/route.ts",
  table: "src/app/api/orders/table/route.ts",
  checkout: "src/app/api/customer/checkouts/route.ts",
} as const;
type RouteName = keyof typeof routePaths;

function project(
  record: Record<string, any>,
  select: Record<string, any>,
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(select).map(([key, field]) => [
      key,
      field === true || record[key] == null
        ? record[key]
        : Array.isArray(record[key])
          ? record[key].map((row: any) => project(row, field.select))
          : project(record[key], field.select),
    ]),
  );
}

function fixture(
  name: RouteName,
  options: {
    role?: "CASHIER" | "WAITER";
    categoryActive?: boolean;
    modifierGroupActive?: boolean;
    availableForSale?: boolean;
    availabilityRestoresAt?: Date | null;
    inventoryEmailFailure?: boolean;
    analyticsFailure?: "client" | "capture" | "flush";
    existingCheckout?: {
      id: string;
      customerId: string;
      amount: number;
      status: string;
    };
  } = {},
) {
  const actor = {
    id: "actor",
    fullName: "Order Actor",
    role: name === "checkout" ? "CUSTOMER" : (options.role ?? "CASHIER"),
    isActive: true,
  };
  const product = {
    id: "product",
    name: "Lunch",
    price: new client.Prisma.Decimal(10),
    cost: new client.Prisma.Decimal(4),
    isActive: true,
    availableForSale: options.availableForSale ?? true,
    availabilityRestoresAt: options.availabilityRestoresAt ?? null,
    recipeVersions: [],
    category: { station: "COOK", isActive: options.categoryActive ?? true },
  };
  const modifier = {
    id: "modifier",
    name: "Extra",
    price: new client.Prisma.Decimal(2),
    productId: "product",
    isActive: true,
    modifierGroup: {
      id: "group",
      name: "Extras",
      isActive: options.modifierGroupActive ?? true,
    },
  };
  const state = {
    transactions: 0,
    writes: 0,
    orders: [] as any[],
    items: [] as any[],
    modifiers: [] as any[],
    payments: [] as any[],
    checkouts: [] as any[],
    deductions: [] as any[],
    tickets: [] as any[],
    productQueries: [] as any[],
    modifierQueries: [] as any[],
    inventoryEmails: 0,
    analyticsCaptures: 0,
  };
  const prisma: Record<string, any> = {
    staff: {
      findUnique: async () => actor,
      findMany: async () => [],
    },
    table: { findFirst: async () => ({ id: "table", name: "Table 1" }) },
    product: {
      findMany: async (query: any) => {
        state.productQueries.push(query);
        const categoryFilter = query.where.category?.is ?? query.where.category;
        if (categoryFilter?.isActive === true && !product.category.isActive) {
          return [];
        }
        return query.where.id.in.includes(product.id)
          ? [project(product, query.select)]
          : [];
      },
    },
    modifier: {
      findMany: async (query: any) => {
        state.modifierQueries.push(query);
        const groupFilter =
          query.where.modifierGroup?.is ?? query.where.modifierGroup;
        if (
          groupFilter?.isActive === true &&
          !modifier.modifierGroup.isActive
        ) {
          return [];
        }
        return query.where.id.in.includes(modifier.id)
          ? [project(modifier, query.select)]
          : [];
      },
    },
    order: {
      create: async ({ data }: any) => {
        state.writes++;
        const saved = {
          id: "order",
          orderNumber: 12,
          createdAt: new Date("2026-10-02T12:00:00Z"),
          ...data,
        };
        state.orders.push(saved);
        return saved;
      },
      findFirst: async () => null,
      update: async ({ data }: any) => {
        state.writes++;
        return Object.assign(state.orders[0], data, {
          tableCheck: { id: "check", checkNumber: 12 },
        });
      },
      aggregate: async () => ({
        _sum: { total: state.orders[0]?.total ?? 0 },
      }),
    },
    orderItem: {
      createMany: async ({ data }: any) => {
        state.writes++;
        state.items.push(...data);
      },
    },
    orderItemModifier: {
      createMany: async ({ data }: any) => {
        state.writes++;
        state.modifiers.push(...data);
      },
    },
    payment: {
      create: async ({ data }: any) => {
        state.writes++;
        state.payments.push(data);
      },
    },
    tableCheck: {
      create: async () => {
        state.writes++;
        return { id: "check", checkNumber: 12 };
      },
    },
    customerCheckout: {
      findUnique: async () => options.existingCheckout ?? null,
      create: async ({ data }: any) => {
        state.writes++;
        const saved = { id: "checkout", status: "PENDING", ...data };
        state.checkouts.push(saved);
        return saved;
      },
    },
    $queryRaw: async () => [],
    $transaction: async (run: (tx: any) => Promise<unknown>) => {
      state.transactions++;
      return run(prisma);
    },
  };
  const route = loadModule(routePaths[name], {
    "next/server": {
      NextResponse: {
        json: (body: unknown, options?: { status: number }) => ({
          body,
          status: options?.status ?? 200,
        }),
      },
    },
    "@prisma/client": client,
    "@/lib/prisma": { prisma },
    "@/lib/auth/permissions": permissions,
    "@/lib/products/availability": availability,
    "@/lib/sales/order-input": input,
    "@/lib/sales/order-postcommit": postCommit,
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: actor.id } } }) },
      }),
    },
    "@/lib/auth/api-authorization": {
      authorizeApi: async () => ({ ok: true, user: actor }),
    },
    "@/lib/waiter/waiter-shifts": {
      getActiveWaiterOrderingShift: async () => ({ id: "shift" }),
    },
    "@/lib/kitchen/kitchen-tickets": {
      createKitchenTicketState: async (_tx: any, value: any) => {
        state.tickets.push(value);
      },
    },
    "@/lib/inventory/inventory-domain": {
      selectEffectiveRecipe: () => null,
      snapshotInventoryCost: () => ({}),
    },
    "@/lib/inventory/inventory": {
      deductProductInventoryForSale: async (_tx: any, lines: any) => {
        state.deductions.push(...lines);
        return [{ productId: "product" }];
      },
      sendInventoryAlerts: async () => {
        state.inventoryEmails++;
        if (options.inventoryEmailFailure) throw new Error("Email unavailable");
      },
    },
    "@/lib/cashier/table-checks": {
      resolveTableCheckIdentity: () => ({ orderNumber: 12 }),
    },
    "@/lib/payments/customer-ussd": {
      normalizeCustomerPaymentPhone: (phone: string) => phone,
    },
    "@/lib/posthog-server": {
      getPostHogClient: () => {
        if (options.analyticsFailure === "client") {
          throw new Error("Analytics client unavailable");
        }
        return {
          capture: () => {
            state.analyticsCaptures++;
            if (options.analyticsFailure === "capture") {
              throw new Error("Analytics capture unavailable");
            }
          },
          flush: async () => {
            if (options.analyticsFailure === "flush") {
              throw new Error("Analytics flush unavailable");
            }
          },
        };
      },
    },
  });
  return { route, state };
}

function body(items: unknown = [{ productId: "product", qty: 1 }]) {
  return {
    items,
    tableId: "table",
    paymentMethod: "OTHER",
    paymentPhone: "901234567",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    customerName: "Customer",
  };
}
const request = (value: unknown) => ({ json: async () => value });
const routeNames = Object.keys(routePaths) as RouteName[];

for (const name of ["sale", "completeSale"] as const) {
  test(`${name}: an active waiter cannot create an immediately paid order`, async () => {
    assert.equal(
      permissions.hasPermission(
        { role: "WAITER" },
        permissions.PERMISSIONS.ORDER_CREATE,
      ),
      true,
    );
    assert.equal(
      permissions.hasPermission(
        { role: "WAITER" },
        permissions.PERMISSIONS.PAYMENT_TAKE,
      ),
      false,
    );
    const f = fixture(name, { role: "WAITER" });
    const response = await f.route.POST(request(body()));
    assert.equal(response.status, 403);
    assert.equal(f.state.transactions, 0);
    assert.equal(f.state.writes, 0);
  });
}

for (const name of routeNames) {
  test(`${name}: invalid item quantities return 400 before writes`, async () => {
    for (const qty of [
      0,
      -1,
      1.5,
      NaN,
      Infinity,
      "2",
      null,
      undefined,
      2147483648,
    ]) {
      const f = fixture(name);
      const response = await f.route.POST(
        request(body([{ productId: "product", qty }])),
      );
      assert.equal(response.status, 400, `quantity ${String(qty)}`);
      assert.equal(f.state.transactions, 0);
      assert.equal(f.state.writes, 0);
    }
  });

  test(`${name}: malformed bodies and item collections return 400 before writes`, async () => {
    const malformed = [
      null,
      [],
      "body",
      body(null),
      body([]),
      body("items"),
      body([null]),
      body([1]),
      body([{ qty: 1 }]),
      body([{ productId: "", qty: 1 }]),
      body([{ productId: 7, qty: 1 }]),
      body([{ productId: "product", qty: 1, modifiers: "modifiers" }]),
      body([{ productId: "product", qty: 1, modifiers: [null] }]),
      body([{ productId: "product", qty: 1, modifiers: [{ qty: 1 }] }]),
    ];
    for (const value of malformed) {
      const f = fixture(name);
      const response = await f.route.POST(request(value));
      assert.equal(response.status, 400, JSON.stringify(value));
      assert.equal(f.state.transactions, 0);
      assert.equal(f.state.writes, 0);
    }
    const f = fixture(name);
    const response = await f.route.POST({
      json: async () => {
        throw new SyntaxError("Malformed JSON");
      },
    });
    assert.equal(response.status, 400);
    assert.equal(f.state.transactions, 0);
    assert.equal(f.state.writes, 0);
  });

  test(`${name}: invalid modifier quantities return 400 before writes`, async () => {
    for (const qty of [0, -1, 1.5, NaN, Infinity, "2", null, 2147483648]) {
      const f = fixture(name);
      const response = await f.route.POST(
        request(
          body([
            {
              productId: "product",
              qty: 1,
              modifiers: [{ modifierId: "modifier", qty }],
            },
          ]),
        ),
      );
      assert.equal(response.status, 400, `modifier quantity ${String(qty)}`);
      assert.equal(f.state.transactions, 0);
      assert.equal(f.state.writes, 0);
    }
  });

  test(`${name}: valid item and modifier quantities retain their values and total`, async () => {
    const f = fixture(name);
    const response = await f.route.POST(
      request(
        body([
          {
            productId: "product",
            qty: 2,
            modifiers: [{ modifierId: "modifier", qty: 3 }],
          },
        ]),
      ),
    );
    assert.equal(response.status, name === "checkout" ? 201 : 200);
    if (name === "checkout") {
      assert.equal(f.state.checkouts.length, 1);
      assert.equal(Number(f.state.checkouts[0].amount), 32);
      assert.equal(f.state.checkouts[0].snapshot[0].qty, 2);
      assert.equal(f.state.checkouts[0].snapshot[0].modifiers[0].qty, 3);
    } else {
      assert.equal(f.state.transactions, 1);
      assert.equal(Number(f.state.orders[0].total), 32);
      assert.equal(f.state.items[0].qty, 2);
      assert.equal(f.state.modifiers[0].qty, 3);
      assert.equal(f.state.deductions[0].qty, 2);
      assert.equal(f.state.tickets[0].lines[0].qty, 2);
      if (name !== "table")
        assert.equal(Number(f.state.payments[0].amountPaid), 32);
    }
  });

  test(`${name}: an omitted optional modifier quantity defaults to one`, async () => {
    const f = fixture(name);
    const response = await f.route.POST(
      request(
        body([
          {
            productId: "product",
            qty: 1,
            modifiers: [{ modifierId: "modifier" }],
          },
        ]),
      ),
    );
    assert.equal(response.status, name === "checkout" ? 201 : 200);
    const selected =
      name === "checkout"
        ? f.state.checkouts[0].snapshot[0].modifiers[0]
        : f.state.modifiers[0];
    assert.equal(selected.qty, 1);
  });

  test(`${name}: products in disabled categories cannot be ordered`, async () => {
    const f = fixture(name, { categoryActive: false });
    const response = await f.route.POST(request(body()));
    assert.equal(response.status, 400);
    assert.equal(f.state.transactions, 0);
    assert.equal(f.state.writes, 0);
  });

  test(`${name}: modifiers in disabled groups cannot be ordered`, async () => {
    const f = fixture(name, { modifierGroupActive: false });
    const response = await f.route.POST(
      request(
        body([
          {
            productId: "product",
            qty: 1,
            modifiers: [{ modifierId: "modifier", qty: 1 }],
          },
        ]),
      ),
    );
    assert.equal(response.status, 400);
    assert.equal(f.state.transactions, 0);
    assert.equal(f.state.writes, 0);
  });
}

for (const name of ["sale", "completeSale", "table"] as const) {
  test(`${name}: failed inventory alert delivery preserves the committed order response`, async () => {
    const f = fixture(name, { inventoryEmailFailure: true });
    const response = await f.route.POST(request(body()));
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(f.state.orders.length, 1);
    assert.equal(f.state.inventoryEmails, 1);
    assert.equal(f.state.payments.length, name === "table" ? 0 : 1);
    if (name !== "sale") assert.equal(f.state.analyticsCaptures, 1);
  });
}

for (const name of ["completeSale", "table"] as const) {
  test(`${name}: analytics initialization, capture, or flush failures preserve order success`, async () => {
    for (const analyticsFailure of ["client", "capture", "flush"] as const) {
      const f = fixture(name, { analyticsFailure });
      const response = await f.route.POST(request(body()));
      assert.equal(response.status, 200, analyticsFailure);
      assert.equal(response.body.success, true);
      assert.equal(f.state.orders.length, 1);
      assert.equal(f.state.payments.length, name === "table" ? 0 : 1);
    }
  });
}

test("checkout: selects availability flags and rejects temporarily unavailable products", async () => {
  const f = fixture("checkout", { availableForSale: false });
  const response = await f.route.POST(request(body()));
  assert.equal(response.status, 409);
  assert.equal(f.state.productQueries[0].select.availableForSale, true);
  assert.equal(f.state.productQueries[0].select.availabilityRestoresAt, true);
  assert.equal(f.state.writes, 0);
});

test("checkout: allows a temporarily unavailable product after its restoration time", async () => {
  const f = fixture("checkout", {
    availableForSale: false,
    availabilityRestoresAt: new Date("2000-01-01T00:00:00Z"),
  });
  const response = await f.route.POST(request(body()));
  assert.equal(response.status, 201);
  assert.equal(f.state.checkouts.length, 1);
});

test("checkout: placeholder modifier quantities follow the same input boundary", async () => {
  const f = fixture("checkout");
  const response = await f.route.POST(
    request(
      body([
        {
          productId: "product",
          qty: 1,
          modifiers: [{ modifierId: "placeholder__custom", qty: 1.5 }],
        },
      ]),
    ),
  );
  assert.equal(response.status, 400);
  assert.equal(f.state.writes, 0);
});

test("checkout: a client placeholder flag cannot bypass a disabled real modifier group", async () => {
  const f = fixture("checkout", { modifierGroupActive: false });
  const response = await f.route.POST(
    request(
      body([
        {
          productId: "product",
          qty: 1,
          modifiers: [
            {
              modifierId: "modifier",
              qty: 1,
              isPlaceholder: true,
              modifierName: "Client supplied name",
              price: 0,
            },
          ],
        },
      ]),
    ),
  );
  assert.equal(response.status, 400);
  assert.equal(f.state.writes, 0);
});

test("checkout: an existing checkout remains retrievable after its product becomes unavailable", async () => {
  const f = fixture("checkout", {
    availableForSale: false,
    categoryActive: false,
    existingCheckout: {
      id: "saved-checkout",
      customerId: "actor",
      amount: 10,
      status: "PENDING",
    },
  });
  const response = await f.route.POST(request(body()));
  assert.equal(response.status, 200);
  assert.equal(response.body.checkout.id, "saved-checkout");
  assert.equal(response.body.checkout.amount, 10);
  assert.equal(f.state.productQueries.length, 0);
  assert.equal(f.state.writes, 0);
});

test("checkout: an existing checkout key remains private to its customer", async () => {
  const f = fixture("checkout", {
    existingCheckout: {
      id: "saved-checkout",
      customerId: "another-customer",
      amount: 10,
      status: "PENDING",
    },
  });
  const response = await f.route.POST(request(body()));
  assert.equal(response.status, 409);
  assert.equal(response.body.checkout, undefined);
  assert.equal(f.state.writes, 0);
});
