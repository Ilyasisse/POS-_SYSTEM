import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("customer review paginates receipts independently and detects the next page", async () => {
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown) => body } },
    "@/lib/payments/payment-receipt-route-auth": {
      currentPaymentReceiptUser: async () => ({ id: "cashier" }),
      canTakePayment: () => true,
      canManagePaymentReceipts: () => false,
    },
    "@/lib/prisma": {
      prisma: {
        customerCheckout: {
          findMany: async ({ skip, take }: { skip: number; take: number }) => {
            assert.equal(skip, 100);
            assert.equal(take, 101);
            return [];
          },
        },
        mobileMoneyReceipt: {
          findMany: async ({ skip, take }: { skip: number; take: number }) => {
            assert.equal(skip, 200);
            assert.equal(take, 101);
            return Array.from({ length: 101 }, (_, index) => ({
              id: `receipt-${skip + index}`,
              amount: 1,
            }));
          },
        },
      },
    },
  };
  const output = ts.transpileModule(
    readFileSync("src/app/api/cashier/customer-checkouts/route.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: {
    GET?: (
      request: Request,
    ) => Promise<{ hasMoreReceipts: boolean; receipts: { id: string }[] }>;
  } = {};
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => dependencies[name] ?? {},
    URL,
  });
  const result = await exports.GET!(
    new Request(
      "https://pos.example/api/cashier/customer-checkouts?checkoutPage=1&receiptPage=2",
    ),
  );
  assert.equal(result.hasMoreReceipts, true);
  assert.equal(result.receipts.length, 100);
  assert.equal(result.receipts[0].id, "receipt-200");
  assert.equal(result.receipts.at(-1)?.id, "receipt-299");
});
