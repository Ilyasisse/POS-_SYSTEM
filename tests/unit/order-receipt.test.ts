import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import FullPageReceipt from "../../src/app/print/orders/[id]/entire-page-receipt/FullPageReceipt";
import ReceiptActions from "../../src/app/print/orders/[id]/ReceiptActions";
import ThermalReceipt from "../../src/app/print/orders/[id]/thermal-receipt/ThermalReceipt";
import { thermalReceiptCss } from "../../src/app/print/orders/[id]/thermal-receipt/thermal-receipt-styles";
import { canViewOrderReceipt } from "../../src/lib/orders/receipt-access";
import {
  buildReceiptData,
  type ReceiptData,
} from "../../src/lib/orders/build-receipt-data";
import { receiptHref } from "../../src/lib/orders/receipt-format";
import {
  receiptOrder,
  receiptSettings,
  largeReceiptOrder,
} from "../fixtures/order-receipt";

function render(
  component: ComponentType<{ receipt: ReceiptData }>,
  order = receiptOrder(),
) {
  return renderToStaticMarkup(
    createElement(component, {
      receipt: buildReceiptData(order, receiptSettings),
    }),
  );
}

test("both formats retain stored amounts without adding modifier charges twice", () => {
  const data = buildReceiptData(receiptOrder(), receiptSettings);
  assert.equal(data.subtotal, "$15.00");
  assert.equal(data.total, "$12.50");
  assert.equal(data.paid, "$12.50");
  assert.equal(data.refunded, "-$1.00");
  assert.equal(data.reductions[0].amount, "-$2.50");
  assert.equal(data.items[0].unitPrice, "$7.50");
  for (const component of [FullPageReceipt, ThermalReceipt]) {
    const html = render(component);
    for (const text of [
      "$15.00",
      "$12.50",
      "-$2.50",
      "-$1.00",
      "Chicken sandwich",
      "1× Extra cheese",
      "PAYMENT-123",
    ]) {
      assert.ok(html.includes(text), text);
    }
  }
});

test("configured currency and timezone are applied, with safe defaults", () => {
  const order = receiptOrder();
  const configured = buildReceiptData(order, {
    ...receiptSettings,
    currencyCode: "EUR",
    timezone: "UTC",
  });
  assert.equal(configured.total, "€12.50");
  assert.match(configured.dateTime, /8:30 AM/);
  assert.match(buildReceiptData(order, null).dateTime, /11:30 AM/);
  const fallback = buildReceiptData(order, {
    businessName: " ",
    currencyCode: "invalid!",
    timezone: "invalid!",
  });
  assert.equal(fallback.businessName, "Mash Allah Cafe");
  assert.equal(fallback.total, "$12.50");
  assert.match(fallback.dateTime, /11:30 AM/);
});

test("missing optional details render without empty payments, notes, or refunds", () => {
  const order = receiptOrder({
    table: null,
    tableCheck: null,
    customer: null,
    waiter: null,
    cashier: null,
    closedAt: null,
    notes: null,
    payments: [],
    salesAdjustments: [],
    orderItems: [],
  });
  for (const component of [FullPageReceipt, ThermalReceipt]) {
    const html = render(component, order);
    assert.ok(html.includes("Counter"));
    assert.ok(html.includes("Cafe staff"));
    assert.ok(html.includes("$0.00"));
    assert.ok(!html.includes("Order note"));
    assert.ok(!html.includes("Refunded"));
    assert.ok(!html.includes("Payments"));
  }
});

test("full-page customer details are preserved and thermal omits customer information", () => {
  assert.ok(render(FullPageReceipt).includes("Private Customer Name"));
  assert.ok(!render(ThermalReceipt).includes("Private Customer Name"));
  const source = {
    ...receiptOrder(),
    id: "INTERNAL-ID",
    customerId: "INTERNAL-CUSTOMER",
    customer: {
      fullName: "Private Customer Name",
      email: "private@example.test",
      phoneNumber: "PRIVATE-PHONE",
    },
  };
  const serialized = JSON.stringify(buildReceiptData(source, receiptSettings));
  for (const privateValue of [
    "INTERNAL-ID",
    "INTERNAL-CUSTOMER",
    "private@example.test",
    "PRIVATE-PHONE",
  ])
    assert.ok(!serialized.includes(privateValue));
});

test("open and cancelled receipts keep their payment-status warning", () => {
  for (const component of [FullPageReceipt, ThermalReceipt]) {
    assert.ok(
      render(component, receiptOrder({ status: "OPEN" })).includes("UNPAID"),
    );
    assert.ok(
      render(component, receiptOrder({ status: "CANCELLED" })).includes(
        "CANCELLED",
      ),
    );
    assert.ok(!render(component).includes("UNPAID"));
  }
});

test("large orders, long names, modifiers and notes are retained and escaped", () => {
  const order = largeReceiptOrder();
  order.notes = '<script>alert("note")</script>';
  for (const component of [FullPageReceipt, ThermalReceipt]) {
    const html = render(component, order);
    assert.ok(html.includes(order.orderItems[0].productName));
    assert.ok(html.includes("Item 100"));
    assert.ok(html.includes("Modifier 18 extra sauce"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("<script>"));
  }
});

test("format selector navigates documents and PDF action describes the browser dialog", () => {
  for (const format of ["full", "thermal"] as const) {
    const html = renderToStaticMarkup(
      createElement(ReceiptActions, { orderId: "order-123", format }),
    );
    assert.ok(
      html.includes(
        `href="${receiptHref("order-123", format)}" aria-current="page"`,
      ),
    );
    assert.ok(html.includes("Full Page Receipt"));
    assert.ok(html.includes("80 mm Thermal Receipt"));
    assert.ok(html.includes("Print Receipt"));
    assert.ok(html.includes("Save as PDF opens Chrome"));
    assert.ok(html.includes("no-print"));
    assert.ok(html.includes("print:hidden"));
  }
  assert.equal(
    receiptHref("a/b", "thermal"),
    "/print/orders/a%2Fb/thermal-receipt",
  );
  assert.match(thermalReceiptCss, /size: 80mm 200mm/);
  assert.match(thermalReceiptCss, /width: 72mm/);
});

// Exercise the real server loader with isolated auth/database dependencies.
function loadModule(path: string, dependencies: Record<string, unknown>) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  vm.runInNewContext(output, {
    exports,
    require(name: string) {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("receipt loader authenticates before querying and protects missing/unauthorized orders", async () => {
  type User = Parameters<typeof canViewOrderReceipt>[0];
  const assignedOrder = {
    ...receiptOrder(),
    customerId: "customer-1",
    waiterId: "waiter-1",
    cashierId: "cashier-1",
  };
  let currentUser: User | null = null;
  let storedOrder: typeof assignedOrder | null = assignedOrder;
  let reads = 0;
  const receiptModule = loadModule("src/lib/orders/order-receipt.ts", {
    "server-only": {},
    "next/navigation": {
      redirect: (url: string) => {
        throw new Error(url);
      },
      notFound: () => {
        throw new Error("NOT_FOUND");
      },
    },
    "@/lib/auth/current-user": { getCurrentUser: async () => currentUser },
    "@/lib/prisma": {
      prisma: {
        order: {
          findUnique: async () => {
            reads++;
            return storedOrder;
          },
        },
        cafeSetting: { findUnique: async () => receiptSettings },
      },
    },
    "./receipt-access": { canViewOrderReceipt },
    "./receipt-data": { buildReceiptData },
  });
  await assert.rejects(
    receiptModule.getOrderReceipt("order"),
    /\/staff-login$/,
  );
  assert.equal(reads, 0);
  for (const [id, role, allowed] of [
    ["customer-1", "CUSTOMER", true],
    ["other", "CUSTOMER", false],
    ["waiter-1", "WAITER", true],
    ["other", "WAITER", false],
    ["other", "CASHIER", true],
    ["other", "ADMIN", true],
    ["other", "MANAGER", true],
    ["other", "COOK", false],
  ] as const) {
    currentUser = { id, role, station: null };
    if (allowed)
      assert.equal(
        ((await receiptModule.getOrderReceipt("order")) as ReceiptData)
          .orderNumber,
        123,
      );
    else
      await assert.rejects(
        receiptModule.getOrderReceipt("order"),
        /unauthorized/,
      );
  }
  storedOrder = null;
  await assert.rejects(receiptModule.getOrderReceipt("missing"), /NOT_FOUND/);
});

test("both page routes obtain receipts from the same protected loader", async () => {
  const jsx = await import("react/jsx-runtime");
  for (const file of [
    "src/app/print/orders/[id]/page.tsx",
    "src/app/print/orders/[id]/thermal-receipt/page.tsx",
  ]) {
    let requested = "";
    const page = loadModule(file, {
      "react/jsx-runtime": jsx,
      "@/lib/orders/order-receipt": {
        getOrderReceipt: async (id: string) => {
          requested = id;
          return buildReceiptData(receiptOrder(), null);
        },
      },
      "./FullPageReceipt": { default: FullPageReceipt },
      "./ReceiptActions": { default: ReceiptActions },
      "../ReceiptActions": { default: ReceiptActions },
      "./ThermalReceipt": { default: ThermalReceipt },
      "./thermal-receipt-styles": { thermalReceiptCss },
    });
    await page.default({ params: Promise.resolve({ id: "protected-order" }) });
    assert.equal(requested, "protected-order");
  }
});
