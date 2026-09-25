import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { chooseUniqueCustomerCheckout } from "../../src/lib/payments/customer-ussd";

// Execute the actual server module with isolated database/side-effect adapters.
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
    require: (name: string) => dependencies[name] ?? {},
    Date,
    console,
  });
  return exports;
}
const statuses = Object.fromEntries(
  [
    "PENDING",
    "REVIEW",
    "EXPIRED",
    "PAYMENT_RECEIVED",
    "NEEDS_HELP",
    "PAID",
  ].map((s) => [s, s]),
);

function fixture(ambiguous = false, phone = "252905109687") {
  const now = Date.now();
  const checkout = {
    id: "checkout",
    status: "REVIEW",
    receiptId: null as string | null,
    amount: 26,
    payerPhone: phone,
    createdAt: new Date(now - 60000),
    expiresAt: new Date(now + 60000),
  };
  const receipt = {
    id: "receipt",
    status: "AVAILABLE",
    direction: "INCOMING",
    method: "GOLIS",
    amount: 26,
    transactionAt: new Date(now - 30000),
    providerReference: "ref",
    counterpartyIdentifiers: ["252905109687"],
  };
  let claims = 0;
  const prisma = {
    customerCheckout: {
      findUnique: async () => checkout,
      findMany: async () =>
        ambiguous ? [checkout, { ...checkout, id: "other" }] : [checkout],
      updateMany: async () => {
        checkout.receiptId = receipt.id;
        checkout.status = "PAYMENT_RECEIVED";
        return { count: 1 };
      },
    },
    mobileMoneyReceipt: {
      findMany: async () => [receipt],
      findUnique: async () => receipt,
      updateMany: async () => {
        claims++;
        receipt.status = "ASSIGNED";
        return { count: 1 };
      },
    },
    $queryRaw: async () => [],
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      // Finalization is separately covered by the order flow; represent an
      // already completed order on its second transaction here.
      if (claims) checkout.status = "PAID";
      return run(prisma);
    },
  };
  const module = loadModule("src/lib/payments/customer-checkout.ts", {
    "@prisma/client": {
      CustomerCheckoutStatus: statuses,
      MobileMoneyReceiptStatus: {
        AVAILABLE: "AVAILABLE",
        ASSIGNED: "ASSIGNED",
      },
    },
    "@/lib/prisma": { prisma },
    "@/lib/payments/customer-ussd": { chooseUniqueCustomerCheckout },
  });
  return {
    checkout,
    retry: () => module.retryCustomerCheckoutPayment(checkout.id),
    claims: () => claims,
  };
}

test("review retry claims an existing matching receipt only once", async () => {
  const f = fixture();
  await f.retry();
  await f.retry();
  assert.equal(f.claims(), 1);
  assert.equal(f.checkout.receiptId, "receipt");
});
test("review retry does not bypass ambiguity or payer matching", async () => {
  for (const f of [fixture(true), fixture(false, "252905109688")]) {
    await f.retry();
    assert.equal(f.claims(), 0);
  }
});
test("expired checkouts stay available for staff review without automatic assignment", async () => {
  const f = fixture();
  f.checkout.expiresAt = new Date(0);
  await f.retry();
  assert.equal(f.claims(), 0);
});
test("review endpoint accepts repeated review and invokes reconciliation", async () => {
  let retries = 0;
  const route = loadModule(
    "src/app/api/customer/checkouts/[id]/review/route.ts",
    {
      "next/server": { NextResponse: { json: (body: unknown) => body } },
      "@/lib/auth/api-authorization": {
        authorizeApi: async () => ({
          ok: true,
          user: { id: "customer", role: "CUSTOMER" },
        }),
      },
      "@/lib/auth/permissions": { PERMISSIONS: {} },
      "@/lib/prisma": {
        prisma: {
          customerCheckout: {
            updateMany: async ({ where }: any) => {
              assert.equal(where.customerId, "customer");
              assert.ok(where.status.in.includes("REVIEW"));
              return { count: 1 };
            },
          },
        },
      },
      "@/lib/payments/customer-checkout": {
        retryCustomerCheckoutPayment: async (id: string) => {
          assert.equal(id, "checkout");
          retries++;
        },
      },
    },
  );
  await route.POST({}, { params: Promise.resolve({ id: "checkout" }) });
  assert.equal(retries, 1);
});
