import { expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";

import vm from "node:vm";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import FullPageReceipt from "../../src/app/print/orders/[id]/entire-page-receipt/FullPageReceipt";
import ReceiptActions from "../../src/app/print/orders/[id]/ReceiptActions";
import ThermalReceipt from "../../src/app/print/orders/[id]/thermal-receipt/ThermalReceipt";
import { thermalReceiptCss } from "../../src/app/print/orders/[id]/thermal-receipt/thermal-receipt-styles";
import { canViewOrderReceipt } from "../../src/lib/orders/receipt-access";
import { buildReceiptData, type ReceiptData } from "../../src/lib/orders/build-receipt-data";
import { receiptHref } from "../../src/lib/orders/receipt-format";
import { receiptOrder, receiptSettings, largeReceiptOrder } from "../fixtures/order-receipt";

function render(component: ComponentType<{ receipt: ReceiptData }>, order = receiptOrder()) {
  return renderToStaticMarkup(
    createElement(component, {
      receipt: buildReceiptData(order, receiptSettings),
    }),
  );
}

test("both formats retain stored amounts without adding modifier charges twice", () => {
  const data = buildReceiptData(receiptOrder(), receiptSettings);
  expect(data.subtotal).toBe("$15.00");
  expect(data.total).toBe("$12.50");
  expect(data.paid).toBe("$12.50");
  expect(data.refunded).toBe("-$1.00");
  expect(data.reductions[0].amount).toBe("-$2.50");
  expect(data.items[0].unitPrice).toBe("$7.50");
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
      expect({ context: text, value: Boolean(html.includes(text)) }).toStrictEqual({
        context: text,
        value: true,
      });
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
  expect(configured.total).toBe("€12.50");
  expect(configured.dateTime).toMatch(/8:30 AM/);
  expect(buildReceiptData(order, null).dateTime).toMatch(/11:30 AM/);
  const fallback = buildReceiptData(order, {
    businessName: " ",
    currencyCode: "invalid!",
    timezone: "invalid!",
  });
  expect(fallback.businessName).toBe("Mash Allah Cafe");
  expect(fallback.total).toBe("$12.50");
  expect(fallback.dateTime).toMatch(/11:30 AM/);
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
    expect(html.includes("Counter")).toBeTruthy();
    expect(html.includes("Cafe staff")).toBeTruthy();
    expect(html.includes("$0.00")).toBeTruthy();
    expect(!html.includes("Order note")).toBeTruthy();
    expect(!html.includes("Refunded")).toBeTruthy();
    expect(!html.includes("Payments")).toBeTruthy();
  }
});

test("full-page customer details are preserved and thermal omits customer information", () => {
  expect(render(FullPageReceipt).includes("Private Customer Name")).toBeTruthy();
  expect(!render(ThermalReceipt).includes("Private Customer Name")).toBeTruthy();
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
    expect(!serialized.includes(privateValue)).toBeTruthy();
});

test("open and cancelled receipts keep their payment-status warning", () => {
  for (const component of [FullPageReceipt, ThermalReceipt]) {
    expect(render(component, receiptOrder({ status: "OPEN" })).includes("UNPAID")).toBeTruthy();
    expect(
      render(component, receiptOrder({ status: "CANCELLED" })).includes("CANCELLED"),
    ).toBeTruthy();
    expect(!render(component).includes("UNPAID")).toBeTruthy();
  }
});

test("large orders, long names, modifiers and notes are retained and escaped", () => {
  const order = largeReceiptOrder();
  order.notes = '<script>alert("note")</script>';
  for (const component of [FullPageReceipt, ThermalReceipt]) {
    const html = render(component, order);
    expect(html.includes(order.orderItems[0].productName)).toBeTruthy();
    expect(html.includes("Item 100")).toBeTruthy();
    expect(html.includes("Modifier 18 extra sauce")).toBeTruthy();
    expect(html.includes("&lt;script&gt;")).toBeTruthy();
    expect(!html.includes("<script>")).toBeTruthy();
  }
});

test("format selector navigates documents and PDF action describes the browser dialog", () => {
  for (const format of ["full", "thermal"] as const) {
    const html = renderToStaticMarkup(
      createElement(ReceiptActions, { orderId: "order-123", format }),
    );
    expect(
      html.includes(`href="${receiptHref("order-123", format)}" aria-current="page"`),
    ).toBeTruthy();
    expect(html.includes("Full Page Receipt")).toBeTruthy();
    expect(html.includes("80 mm Thermal Receipt")).toBeTruthy();
    expect(html.includes("Print Receipt")).toBeTruthy();
    expect(html.includes("Save as PDF opens Chrome")).toBeTruthy();
    expect(html.includes("no-print")).toBeTruthy();
    expect(html.includes("print:hidden")).toBeTruthy();
  }
  expect(receiptHref("a/b", "thermal")).toBe("/print/orders/a%2Fb/thermal-receipt");
  expect(thermalReceiptCss).toMatch(/size: 80mm 200mm/);
  expect(thermalReceiptCss).toMatch(/width: 72mm/);
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
      expect({
        context: `Unexpected dependency ${name}`,
        value: Boolean(name in dependencies),
      }).toStrictEqual({ context: `Unexpected dependency ${name}`, value: true });
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
  const receiptModule = loadModule("src/lib/orders/get-order-receipt.ts", {
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
    "./build-receipt-data": { buildReceiptData },
  });
  await expect(receiptModule.getOrderReceipt("order")).rejects.toThrow(/\/staff-login$/);
  expect(reads).toBe(0);
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
      expect(((await receiptModule.getOrderReceipt("order")) as ReceiptData).orderNumber).toBe(123);
    else await expect(receiptModule.getOrderReceipt("order")).rejects.toThrow(/unauthorized/);
  }
  storedOrder = null;
  await expect(receiptModule.getOrderReceipt("missing")).rejects.toThrow(/NOT_FOUND/);
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
      "@/lib/orders/get-order-receipt": {
        getOrderReceipt: async (id: string) => {
          requested = id;
          return buildReceiptData(receiptOrder(), null);
        },
      },
      "./entire-page-receipt/FullPageReceipt": { default: FullPageReceipt },
      "./ReceiptActions": { default: ReceiptActions },
      "../ReceiptActions": { default: ReceiptActions },
      "./ThermalReceipt": { default: ThermalReceipt },
      "./thermal-receipt-styles": { thermalReceiptCss },
    });
    await page.default({ params: Promise.resolve({ id: "protected-order" }) });
    expect(requested).toBe("protected-order");
  }
});
