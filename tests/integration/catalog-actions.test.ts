import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as catalog from "../../src/lib/catalog/catalog";
import * as availability from "../../src/lib/products/availability";

type Actions = typeof import("../../src/app/admin/(catalog)/actions");
type Queries = typeof import("../../src/lib/catalog/queries");
type Query = {
  where?: {
    id?: string;
    updatedAt?: Date;
    categoryId?: string;
    idIn?: string[];
  };
  data?: Record<string, unknown> | Record<string, unknown>[];
};
type Call = { model: string; method: string; input: unknown };
type Category = {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt: Date;
};
const version = "2026-10-21T08:00:00.000Z";
const initialCounts = {
  orderItems: 0,
  modifiers: 0,
  supplierCatalogItems: 0,
  recipeVersions: 0,
  stockEvents: 0,
  inventoryCountLines: 0,
};

class DatabaseError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

// Execute the actual server module with auth, cache and persistence injected at
// its boundaries. These tests require neither credentials nor a live database.
function harness() {
  const calls: Call[] = [];
  const refreshed: string[] = [];
  const state = {
    authorized: true,
    product: {
      id: "coffee",
      name: "Coffee",
      updatedAt: new Date(version),
      availableForSale: false,
      availabilityReason: "Beans delayed" as string | null,
      availabilityRestoresAt: null as Date | null,
      stockQty: 7,
      isActive: true,
      _count: { ...initialCounts },
    },
    categories: [
      {
        id: "drinks",
        name: "Drinks",
        sortOrder: 0,
        updatedAt: new Date(version),
      },
      { id: "food", name: "Food", sortOrder: 1, updatedAt: new Date(version) },
    ] as Category[],
    categoryProductCount: 0,
    groupOptionCount: 0,
    orderModifierCount: 0,
    selectedProductCount: 2,
    groupExists: true,
    failCategoryId: "",
  };
  const capture = (model: string, method: string, input: unknown) =>
    calls.push({ model, method, input });
  const tx = {
    product: {
      findUnique: async (input: Query) => {
        capture("product", "findUnique", input);
        return structuredClone(state.product);
      },
      count: async (input: Query) => {
        capture("product", "count", input);
        return input.where?.categoryId
          ? state.categoryProductCount
          : state.selectedProductCount;
      },
      update: async (input: Query) => {
        capture("product", "update", input);
        Object.assign(state.product, input.data);
        return state.product;
      },
      create: async (input: Query) => {
        capture("product", "create", input);
        return { id: "created-product" };
      },
      delete: async (input: Query) => {
        capture("product", "delete", input);
        return state.product;
      },
      findMany: async (input: unknown) => {
        capture("product", "findMany", input);
        return [];
      },
    },
    category: {
      findUnique: async (input: Query) => {
        capture("category", "findUnique", input);
        return { id: "drinks" };
      },
      findMany: async (input: unknown) => {
        capture("category", "findMany", input);
        return state.categories.map((row) => ({ ...row }));
      },
      count: async (input: unknown) => {
        capture("category", "count", input);
        return state.categories.length;
      },
      update: async (input: Query) => {
        capture("category", "update", input);
        if (input.where?.id === state.failCategoryId)
          throw new DatabaseError("P2034");
        const row = state.categories.find((row) => row.id === input.where?.id);
        if (!row) throw new DatabaseError("P2025");
        Object.assign(row, input.data);
        return row;
      },
      create: async (input: Query) => {
        capture("category", "create", input);
        return {};
      },
      delete: async (input: Query) => {
        capture("category", "delete", input);
        return {};
      },
    },
    modifier: {
      count: async (input: unknown) => {
        capture("modifier", "count", input);
        return state.groupOptionCount;
      },
      createMany: async (input: Query) => {
        capture("modifier", "createMany", input);
        return {};
      },
      update: async (input: Query) => {
        capture("modifier", "update", input);
        return {};
      },
      delete: async (input: Query) => {
        capture("modifier", "delete", input);
        return {};
      },
      findMany: async (input: unknown) => {
        capture("modifier", "findMany", input);
        return [];
      },
    },
    modifierGroup: {
      findUnique: async (input: Query) => {
        capture("modifierGroup", "findUnique", input);
        return state.groupExists ? { id: "milk" } : null;
      },
      count: async (input: unknown) => {
        capture("modifierGroup", "count", input);
        return 0;
      },
      findMany: async (input: unknown) => {
        capture("modifierGroup", "findMany", input);
        return [];
      },
      create: async (input: Query) => {
        capture("modifierGroup", "create", input);
        return {};
      },
      update: async (input: Query) => {
        capture("modifierGroup", "update", input);
        return {};
      },
      delete: async (input: Query) => {
        capture("modifierGroup", "delete", input);
        return {};
      },
    },
    orderItemModifier: {
      count: async (input: unknown) => {
        capture("orderItemModifier", "count", input);
        return state.orderModifierCount;
      },
    },
    auditLog: {
      create: async (input: Query) => {
        capture("auditLog", "create", input);
        return {};
      },
    },
  };
  const prisma = {
    ...tx,
    $transaction: async (
      run: (client: typeof tx) => Promise<unknown>,
      options: unknown,
    ) => {
      capture("transaction", "begin", options);
      const before = {
        product: structuredClone(state.product),
        categories: structuredClone(state.categories),
      };
      try {
        return await run(tx);
      } catch (error) {
        state.product = before.product;
        state.categories = before.categories;
        throw error;
      }
    },
  };
  const authFailure = new Error("Permission denied");
  const modules: Record<string, unknown> = {
    zod: { z },
    "@prisma/client": {
      Prisma: {
        PrismaClientKnownRequestError: DatabaseError,
        TransactionIsolationLevel: { Serializable: "Serializable" },
      },
    },
    "next/cache": { revalidatePath: (path: string) => refreshed.push(path) },
    "next/navigation": {
      notFound: () => {
        throw new Error("Not found");
      },
    },
    "@/lib/prisma": { prisma },
    "@/lib/auth/permissions": {
      PERMISSIONS: { CATALOG_MANAGE: "CATALOG_MANAGE" },
    },
    "@/lib/auth/require-permission": {
      requirePermission: async (permission: string) => {
        capture("auth", "requirePermission", permission);
        if (!state.authorized) throw authFailure;
        return { id: "admin" };
      },
    },
    "@/lib/products/availability": availability,
    "@/lib/catalog/catalog": catalog,
  };
  function load<T>(path: string): T {
    const source = ts.transpileModule(
      readFileSync(resolve(process.cwd(), path), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
      },
    ).outputText;
    const exports = {};
    vm.runInNewContext(
      source,
      {
        exports,
        require: (id: string) => {
          if (!(id in modules)) throw new Error(`Unexpected dependency: ${id}`);
          return modules[id];
        },
        console: { error: () => undefined },
      },
      { filename: path },
    );
    return exports as T;
  }
  return {
    actions: load<Actions>("src/app/admin/(catalog)/actions.ts"),
    queries: load<Queries>("src/lib/catalog/queries.ts"),
    state,
    calls,
    refreshed,
    authFailure,
  };
}

function form(values: Record<string, string | string[]>): FormData {
  const result = new FormData();
  for (const [name, value] of Object.entries(values))
    for (const item of typeof value === "string" ? [value] : value)
      result.append(name, item);
  return result;
}
const identity = { id: "coffee", updatedAt: version };
const pause = {
  ...identity,
  availableForSale: "off",
  availabilityReason: "Beans delayed",
  durationMinutes: "",
};
const modifier = {
  name: "Extra milk",
  price: "0",
  isActive: "on",
  productIds: ["coffee", "tea", "coffee"],
  modifierGroupId: "milk",
  pronunciationAudioUrl: "/uploads/milk.webm",
};

test("all catalog mutations authorize before validation or database access", async () => {
  const h = harness();
  h.state.authorized = false;
  for (const call of [
    () => h.actions.saveCatalogItem("products", new FormData()),
    () => h.actions.changeCatalogAvailability(new FormData()),
    () => h.actions.deleteCatalogItem("products", new FormData()),
    () => h.actions.saveCategoryOrder({}),
  ])
    await assert.rejects(call, (error) => error === h.authFailure);
  assert.equal(h.calls.length, 4);
  assert.ok(
    h.calls.every(
      (call) => call.model === "auth" && call.input === "CATALOG_MANAGE",
    ),
  );
});

test("catalog list and direct editor reads authorize before option or item queries", async () => {
  const h = harness();
  h.state.authorized = false;
  for (const kind of catalog.catalogKinds)
    await assert.rejects(
      () => h.queries.getCatalogData(kind, {}, "coffee"),
      (error) => error === h.authFailure,
    );
  assert.equal(h.calls.length, 4);
  assert.ok(h.calls.every((call) => call.model === "auth"));
});

test("resuming sales clears pause state, records an audit, refreshes customers and never changes stock", async () => {
  const h = harness();
  const result = await h.actions.changeCatalogAvailability(
    form({ ...pause, availableForSale: "on", stockQty: "999" }),
  );
  assert.equal(result.ok, true);
  assert.equal(h.state.product.availableForSale, true);
  assert.equal(h.state.product.availabilityReason, null);
  assert.equal(h.state.product.availabilityRestoresAt, null);
  assert.equal(h.state.product.stockQty, 7);
  const write = h.calls.find(
    (call) => call.model === "product" && call.method === "update",
  )!.input as Query;
  assert.deepEqual(Object.keys(write.data!).sort(), [
    "availabilityReason",
    "availabilityRestoresAt",
    "availableForSale",
  ]);
  assert.ok(
    h.calls.some(
      (call) => call.model === "auditLog" && call.method === "create",
    ),
  );
  assert.ok(
    h.refreshed.includes("/menu") &&
      h.refreshed.includes("/api/GET/Product/all") &&
      h.refreshed.includes("/admin"),
  );
});

test("manual and timed sold-out changes keep inventory intact", async () => {
  const manual = harness();
  assert.equal(
    (await manual.actions.changeCatalogAvailability(form(pause))).ok,
    true,
  );
  assert.equal(manual.state.product.availabilityRestoresAt, null);
  const timed = harness();
  const before = Date.now();
  assert.equal(
    (
      await timed.actions.changeCatalogAvailability(
        form({ ...pause, durationMinutes: "60" }),
      )
    ).ok,
    true,
  );
  const restoresAt = timed.state.product.availabilityRestoresAt!.getTime();
  assert.ok(
    restoresAt >= before + 3_600_000 && restoresAt <= Date.now() + 3_600_000,
  );
  assert.equal(timed.state.product.stockQty, 7);
});

test("stale availability changes fail without updates or cache refresh", async () => {
  const h = harness();
  const result = await h.actions.changeCatalogAvailability(
    form({ ...pause, updatedAt: "2026-10-21T07:00:00.000Z" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /changed/);
  assert.ok(!h.calls.some((call) => call.method === "update"));
  assert.equal(h.refreshed.length, 0);
});

test("invalid mutation fields and unsupported catalog sections never open a transaction", async () => {
  const h = harness();
  assert.equal(
    (
      await h.actions.saveCatalogItem(
        "modifiers",
        form({ ...modifier, price: "Infinity" }),
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await h.actions.saveCatalogItem(
        "tables" as catalog.CatalogKind,
        form(modifier),
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await h.actions.changeCatalogAvailability(
        form({ ...pause, availabilityReason: "x" }),
      )
    ).ok,
    false,
  );
  assert.ok(!h.calls.some((call) => call.model === "transaction"));
});

test("multi-product creation deduplicates selection and preserves pronunciation audio", async () => {
  const h = harness();
  const result = await h.actions.saveCatalogItem("modifiers", form(modifier));
  assert.equal(result.ok, true);
  const write = h.calls.find(
    (call) => call.model === "modifier" && call.method === "createMany",
  )!.input as Query;
  const data = write.data as Record<string, unknown>[];
  assert.deepEqual(
    data.map((row) => row.productId),
    ["coffee", "tea"],
  );
  assert.ok(
    data.every(
      (row) =>
        row.pronunciationAudioUrl === "/uploads/milk.webm" && row.price === 0,
    ),
  );
  assert.equal(
    h.calls.filter((call) => call.model === "transaction").length,
    1,
  );
});

test("product editor saves preserve pronunciation and never accept stock fields from the form", async () => {
  const h = harness();
  const result = await h.actions.saveCatalogItem(
    "products",
    form({
      ...identity,
      name: "Coffee renamed",
      price: "3.25",
      categoryId: "drinks",
      isActive: "on",
      trackStock: "on",
      imageUrl: "",
      description: "Freshly brewed",
      pronunciationAudioUrl: "/uploads/coffee.webm",
      availableForSale: "on",
      availabilityReason: "",
      durationMinutes: "",
      stockQty: "1000",
    }),
  );
  assert.equal(result.ok, true);
  const write = h.calls.find(
    (call) => call.model === "product" && call.method === "update",
  )!.input as Query;
  assert.equal(
    (write.data as Record<string, unknown>).pronunciationAudioUrl,
    "/uploads/coffee.webm",
  );
  assert.equal((write.data as Record<string, unknown>).price, 3.25);
  assert.ok(!Object.hasOwn(write.data!, "stockQty"));
  assert.equal(h.state.product.stockQty, 7);
});

test("an existing modifier cannot be reassigned to multiple products in one edit", async () => {
  const h = harness();
  const result = await h.actions.saveCatalogItem(
    "modifiers",
    form({ ...modifier, ...identity }),
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /exactly one product/);
  assert.ok(
    !h.calls.some(
      (call) =>
        call.model === "modifier" &&
        ["update", "createMany"].includes(call.method),
    ),
  );
});

test("missing product or group links reject modifier creation before writes", async () => {
  for (const missing of ["product", "group"]) {
    const h = harness();
    if (missing === "product") h.state.selectedProductCount = 1;
    else h.state.groupExists = false;
    assert.equal(
      (await h.actions.saveCatalogItem("modifiers", form(modifier))).ok,
      false,
    );
    assert.ok(
      !h.calls.some((call) =>
        ["createMany", "update", "create"].includes(call.method),
      ),
    );
  }
});

test("deletion requires explicit confirmation and a current item version", async () => {
  const h = harness();
  assert.equal(
    (await h.actions.deleteCatalogItem("products", form(identity))).ok,
    false,
  );
  assert.equal(
    (
      await h.actions.deleteCatalogItem(
        "products",
        form({ id: "coffee", confirmed: "yes" }),
      )
    ).ok,
    false,
  );
  assert.ok(!h.calls.some((call) => call.model === "transaction"));
});

test("referenced products are deactivated while orders, inventory and stock are preserved", async () => {
  for (const reference of Object.keys(
    initialCounts,
  ) as (keyof typeof initialCounts)[]) {
    const h = harness();
    h.state.product.stockQty = 0;
    h.state.product._count[reference] = 1;
    const result = await h.actions.deleteCatalogItem(
      "products",
      form({ ...identity, confirmed: "yes" }),
    );
    assert.equal(result.ok, true, reference);
    assert.match(result.message, /deactivated/);
    assert.equal(h.state.product.isActive, false);
    assert.equal(h.state.product._count[reference], 1);
    assert.ok(!h.calls.some((call) => call.method === "delete"));
  }
});

test("products with remaining stock are deactivated; empty unreferenced products may be deleted", async () => {
  const stocked = harness();
  assert.equal(
    (
      await stocked.actions.deleteCatalogItem(
        "products",
        form({ ...identity, confirmed: "yes" }),
      )
    ).ok,
    true,
  );
  assert.equal(stocked.state.product.stockQty, 7);
  assert.ok(!stocked.calls.some((call) => call.method === "delete"));
  const empty = harness();
  empty.state.product.stockQty = 0;
  assert.equal(
    (
      await empty.actions.deleteCatalogItem(
        "products",
        form({ ...identity, confirmed: "yes" }),
      )
    ).ok,
    true,
  );
  assert.ok(
    empty.calls.some(
      (call) => call.model === "product" && call.method === "delete",
    ),
  );
});

test("order-linked modifiers are deactivated instead of deleting historical records", async () => {
  const h = harness();
  h.state.orderModifierCount = 2;
  const result = await h.actions.deleteCatalogItem(
    "modifiers",
    form({ ...identity, confirmed: "yes" }),
  );
  assert.equal(result.ok, true);
  assert.match(result.message, /deactivated/);
  assert.ok(
    h.calls.some(
      (call) => call.model === "modifier" && call.method === "update",
    ),
  );
  assert.ok(!h.calls.some((call) => call.method === "delete"));
});

test("categories containing products and groups containing options cannot be deleted", async () => {
  for (const kind of ["categories", "modifier-groups"] as const) {
    const h = harness();
    h.state.categoryProductCount = 1;
    h.state.groupOptionCount = 1;
    const result = await h.actions.deleteCatalogItem(
      kind,
      form({ ...identity, confirmed: "yes" }),
    );
    assert.equal(result.ok, false);
    assert.match(result.message, /deactivate/);
    assert.ok(!h.calls.some((call) => call.method === "delete"));
  }
});

function orderInput(h: ReturnType<typeof harness>, ids = ["food", "drinks"]) {
  return {
    ids,
    expected: h.state.categories.map((row) => ({
      id: row.id,
      sortOrder: row.sortOrder,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

test("category reordering persists the complete menu within one serializable transaction", async () => {
  const h = harness();
  const result = await h.actions.saveCategoryOrder(orderInput(h));
  assert.equal(result.ok, true);
  assert.deepEqual(
    h.state.categories.map((row) => [row.id, row.sortOrder]),
    [
      ["drinks", 1],
      ["food", 0],
    ],
  );
  const transactions = h.calls.filter((call) => call.model === "transaction");
  assert.equal(transactions.length, 1);
  assert.equal(
    (transactions[0].input as { isolationLevel: string }).isolationLevel,
    "Serializable",
  );
  assert.ok(
    h.refreshed.includes("/menu") && h.refreshed.includes("/api/GET/Category"),
  );
});

test("category reorder rejects conflicting snapshots and invalid permutations before updating", async () => {
  for (const ids of [["drinks", "drinks"], ["food"], ["food", "unknown"]]) {
    const h = harness();
    assert.equal(
      (await h.actions.saveCategoryOrder(orderInput(h, ids))).ok,
      false,
    );
    assert.ok(!h.calls.some((call) => call.method === "update"));
  }
  const h = harness();
  const stale = orderInput(h);
  h.state.categories[0].updatedAt = new Date("2026-10-21T09:00:00.000Z");
  const result = await h.actions.saveCategoryOrder(stale);
  assert.equal(result.ok, false);
  assert.match(result.message, /order changed/);
  assert.ok(!h.calls.some((call) => call.method === "update"));
});

test("a mid-reorder database conflict rolls back the transaction and never reports success", async () => {
  const h = harness();
  h.state.failCategoryId = "drinks";
  const initial = structuredClone(h.state.categories);
  const result = await h.actions.saveCategoryOrder(orderInput(h));
  assert.equal(result.ok, false);
  assert.deepEqual(h.state.categories, initial);
  assert.equal(h.refreshed.length, 0);
});

test("product filters combine category, hidden menu status and sale availability with bounded pagination", async () => {
  const h = harness();
  h.state.categoryProductCount = 37;
  const data = await h.queries.getCatalogData("products", {
    q: "  Coffee ",
    category: "drinks",
    status: "hidden",
    availability: "sold-out",
    page: "999",
  });
  assert.equal(data.page, 4);
  assert.equal(data.pages, 4);
  assert.equal(data.total, 37);
  const read = h.calls.find(
    (call) => call.model === "product" && call.method === "findMany",
  )!.input as {
    skip: number;
    take: number;
    where: {
      categoryId: string;
      category: { isActive: boolean };
      name: { contains: string };
      availableForSale: boolean;
      OR: unknown[];
    };
  };
  assert.equal(read.skip, 30);
  assert.equal(read.take, 10);
  assert.equal(read.where.categoryId, "drinks");
  assert.equal(read.where.category.isActive, false);
  assert.equal(read.where.name.contains, "Coffee");
  assert.equal(read.where.availableForSale, false);
  assert.equal(read.where.OR.length, 2);
});
