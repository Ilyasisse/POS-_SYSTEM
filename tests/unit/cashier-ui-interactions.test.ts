import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import test, { before, afterEach, after } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React, { act, type ComponentType } from "react";
import type { Root } from "react-dom/client";
import { Window } from "happy-dom";

const localRequire = createRequire(import.meta.url);
const dom = new Window({ url: "http://localhost" });
const document = dom.document as unknown as Document;
let createRoot: typeof import("react-dom/client").createRoot;
let root: Root | undefined;
let host: HTMLDivElement;
const router = { push: () => {}, refresh: () => {} };
const toasts = { toast: () => "test-toast" };
const noAos = { useAos: () => {} };

before(async () => {
  dom.happyDOM.setWindowSize({ width: 390, height: 844 });
  for (const name of [
    "window",
    "self",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "Node",
    "Element",
    "MutationObserver",
    "CustomEvent",
    "Event",
    "KeyboardEvent",
    "MouseEvent",
    "NodeFilter",
    "DocumentFragment",
    "HTMLButtonElement",
    "getComputedStyle",
  ]) {
    const value =
      name === "window" || name === "self"
        ? dom
        : name === "document"
          ? document
          : Reflect.get(dom, name);
    Object.defineProperty(globalThis, name, {
      value: typeof value === "function" && name === "getComputedStyle" ? value.bind(dom) : value,
      configurable: true,
    });
  }
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    configurable: true,
  });
  createRoot = (await import("react-dom/client")).createRoot;
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});
after(() => dom.happyDOM.abort());

function component(path: string, fetcher: typeof fetch, overrides: Record<string, unknown> = {}) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports: { default?: ComponentType<Record<string, unknown>> } = {};
  vm.runInNewContext(
    output,
    {
      exports,
      console,
      window: dom,
      document: document,
      crypto: globalThis.crypto,
      fetch: fetcher,
      require: (name: string) => {
        if (name in overrides) return overrides[name];
        if (name === "next/navigation") return { useRouter: () => router };
        if (name === "@/components/ui/toast") return { useToast: () => toasts };
        if (name === "@/components/AosInitializer") return noAos;
        return localRequire(
          name.startsWith("@/")
            ? resolve("src", name.slice(2))
            : name.startsWith(".")
              ? resolve(dirname(path), name)
              : name,
        );
      },
    },
    { filename: path },
  );
  assert.ok(exports.default);
  return exports.default;
}
async function mount(
  Component: ComponentType<Record<string, unknown>>,
  props: Record<string, unknown> = {},
) {
  host = document.createElement("div") as unknown as HTMLDivElement;
  document.body.appendChild(host as unknown as typeof document.body);
  root = createRoot(host);
  await act(async () => {
    root!.render(React.createElement(Component, props));
  });
  await settle();
}
async function settle() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 35));
  });
}
function button(text: string) {
  const found = Array.from(document.querySelectorAll("button")).find((node) =>
    node.textContent?.includes(text),
  );
  assert.ok(found, `Missing button: ${text}`);
  return found;
}
async function click(text: string) {
  await act(async () => button(text).click());
  await settle();
}
async function input(node: Element | null, value: string) {
  assert.ok(node);
  await act(async () => {
    const proto =
      node.tagName === "SELECT" ? dom.HTMLSelectElement.prototype : dom.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value);
    node.dispatchEvent(
      new dom.Event(node.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }) as unknown as Event,
    );
  });
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

test("mobile order addition does not open the cart; cart keeps quantities, notes and explicit review", async () => {
  const product = {
    id: "tea",
    name: "Tea",
    price: 1,
    category: { id: "drinks", name: "Drinks", station: "KITCHEN" },
    modifierGroups: [],
  };
  const Component = component(
    "src/components/cashier/CashierOrderExperience.tsx",
    async () => json({}),
    {
      "@/hooks/waiter/useWaiterData": {
        useWaiterData: () => ({
          productsAll: [product],
          categories: [],
          baristas: [],
          loading: false,
        }),
      },
    },
  );
  await mount(Component, { tables: [{ id: "t2", name: "Table 02" }], initialTableId: "t2" });
  await click("Add");
  assert.match(document.body.textContent, /1 items/);
  assert.equal(document.querySelector('[role="dialog"]'), null);
  await click("View order");
  assert.ok(document.querySelector('[role="dialog"]'));
  const plus = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Increase quantity for Tea"]',
  );
  assert.ok(plus);
  await act(async () => plus.click());
  assert.match(document.body.textContent, /2 items/);
  assert.ok(document.querySelector('textarea[aria-label="Special requests or notes"]'));
});

test("empty table picker offers an exit", async () => {
  const Component = component(
    "src/components/cashier/CashierOrderExperience.tsx",
    async () => json({}),
    {
      "@/hooks/waiter/useWaiterData": {
        useWaiterData: () => ({ productsAll: [], categories: [], baristas: [], loading: false }),
      },
    },
  );
  await mount(Component, { tables: [] });
  assert.match(document.body.textContent, /Every active table/);
  assert.ok(document.querySelector('[role="dialog"] a[href="/cashier"]'));
});

test("payer setup survives steps and close/reopen, partial matching and oversized receipts stay guarded", async () => {
  let posts = 0;
  const request = {
    id: "p1",
    payerName: "Test Customer",
    payerPhone: "1234567",
    amount: 18,
    paidAmount: 10,
    remainingAmount: 8,
    status: "PARTIALLY_MATCHED",
  };
  const receipt = {
    id: "r1",
    reference: "839214",
    amount: 8,
    counterpartyLabel: "Test Customer",
    counterpartyIdentifiers: ["1234567"],
    status: "AVAILABLE",
    direction: "INCOMING",
    transactionAt: "2026-11-06T10:00:00Z",
    rawMessage: "Synthetic receipt",
    providerBalance: null,
    parseError: null,
    assignment: null,
    customerCheckout: null,
  };
  const Component = component(
    "src/components/cashier/CashierPaymentDialog.tsx",
    async (url, init) => {
      if (init?.method === "POST") {
        posts++;
        return json({ requests: [request] });
      }
      return String(url).includes("payment-receipts")
        ? json({ receipts: [receipt, { ...receipt, id: "large", amount: 12 }], canManage: false })
        : json({ requests: [request] });
    },
  );
  await mount(Component, {
    tableId: "t2",
    tableName: "Table 02",
    amountDue: 18,
    showEqualSplit: false,
  });
  await click("Take payment");
  await input(document.querySelector("select"), "GOLIS");
  const fields = document.querySelectorAll('[role="dialog"] input');
  await input(fields[0], "Test Customer");
  await input(fields[1], "1234567");
  await click("Continue to receipts");
  assert.equal(posts, 1);
  assert.match(document.body.textContent, /Remaining \$8.00/);
  assert.equal(button("Assign $12.00").disabled, true);
  assert.equal(button("Assign $8.00").disabled, false);
  await click("1 · Payers");
  assert.equal(document.querySelector("fieldset")?.disabled, true);
  await click("Return to receipts");
  assert.equal(posts, 1);
  const close = document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]');
  assert.ok(close);
  await act(async () => close.click());
  await click("Take payment");
  assert.match(document.body.textContent, /Remaining \$8.00/);
  assert.equal(posts, 1);
  await click("Assign $8.00");
  assert.equal(posts, 2);
});

test("customer review requires exact amounts, reason and confirmation, and clears verification on pair changes", async () => {
  const now = Date.now();
  const checkout = {
    id: "c1",
    customerName: "Test Customer",
    payerPhone: "1234567",
    amount: 12,
    status: "REVIEW",
    receiptId: null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 600000).toISOString(),
  };
  const receipt = {
    id: "r1",
    amount: 12,
    providerReference: "839225",
    counterpartyLabel: "Test Customer",
    counterpartyIdentifiers: ["1234567"],
    rawMessage: "Synthetic SMS",
    transactionAt: new Date(now).toISOString(),
  };
  let posts = 0;
  const Component = component(
    "src/components/cashier/CustomerCheckoutReview.tsx",
    async (_url, init) => {
      if (init?.method === "POST") {
        posts++;
        return json({});
      }
      return json({
        checkouts: [checkout],
        receipts: [receipt, { ...receipt, id: "r2", amount: 9 }],
        canManage: false,
        hasMoreCheckouts: false,
        hasMoreReceipts: false,
      });
    },
  );
  await mount(Component);
  const choose = async (name: string, index = 0) => {
    const node = document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)[index];
    assert.ok(node);
    await act(async () => node.click());
  };
  await choose("checkout");
  await choose("receipt");
  assert.equal(button("Assign receipt and finish").disabled, true);
  assert.match(document.body.textContent, /Amounts match — verify payer/);
  await input(
    document.querySelector('input[placeholder="Explain the evidence used to verify this payment"]'),
    "Checked synthetic reference",
  );
  const check = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
  assert.ok(check);
  await act(async () => check.click());
  assert.equal(button("Assign receipt and finish").disabled, false);
  await choose("receipt", 1);
  assert.equal(button("Assign receipt and finish").disabled, true);
  assert.match(document.body.textContent, /Amounts differ/);
  assert.equal(posts, 0);
  await choose("receipt");
  assert.equal(button("Assign receipt and finish").disabled, true);
});

test("table search hides rather than unmounts payment state and rounds start collapsed", async () => {
  const PaymentStub = () => {
    const [value, set] = React.useState("");
    return React.createElement("input", {
      "aria-label": "Draft payer",
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value),
    });
  };
  const Component = component(
    "src/components/cashier/CashierTableBoard.tsx",
    async () => json({}),
    {
      "./CashierPaymentDialog": { default: PaymentStub },
    },
  );
  await mount(Component, {
    showEqualSplit: false,
    tables: [
      {
        id: "t2",
        name: "Table 02",
        checks: [
          {
            key: "bill",
            orderNumber: 273,
            total: 18,
            rounds: [
              { id: "round", roundNumber: 1, time: "1:00 PM", cashierName: null, items: [] },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(document.querySelector("details")?.open, false);
  await input(document.querySelector('[aria-label="Draft payer"]'), "Saved draft");
  await input(document.querySelector('input[type="search"]'), "No match");
  assert.equal(document.querySelector("article")?.hidden, true);
  await input(document.querySelector('input[type="search"]'), "#273");
  assert.equal(document.querySelector("article")?.hidden, false);
  assert.equal(
    (document.querySelector('[aria-label="Draft payer"]') as unknown as HTMLInputElement).value,
    "Saved draft",
  );
});

test("equal splitting remains feature-gated and creates exact-cent shares", async () => {
  const Component = component("src/components/cashier/CashierPaymentDialog.tsx", async () =>
    json({}),
  );
  await mount(Component, { tableId: "t", tableName: "Table", amountDue: 10, showEqualSplit: true });
  await click("Take payment");
  await input(document.querySelector('[aria-label="Number of people sharing the bill"]'), "3");
  await click("Create equal shares");
  const amounts = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'),
  ).map((node) => node.value);
  assert.deepEqual(amounts, ["3.34", "3.33", "3.33"]);
});

test("takeaway retains payment selection and posts once to the paid counter endpoint", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const product = {
    id: "tea",
    name: "Tea",
    price: 1,
    category: { id: "drinks", name: "Drinks", station: "KITCHEN" },
    modifierGroups: [],
  };
  const Component = component(
    "src/components/cashier/CashierOrderExperience.tsx",
    async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return json({ success: true });
    },
    {
      "@/hooks/waiter/useWaiterData": {
        useWaiterData: () => ({
          productsAll: [product],
          categories: [],
          baristas: [],
          loading: false,
        }),
      },
    },
  );
  await mount(Component, { tables: [], orderType: "TAKEOUT" });
  assert.equal(document.querySelector('[role="dialog"]'), null);
  await click("Add");
  await click("View order");
  await input(document.querySelector("select"), "GOLIS");
  const submit = button("Pay and send to kitchen");
  await act(async () => {
    submit.click();
    submit.click();
  });
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/orders");
  assert.equal(calls[0].body.orderType, "TAKEOUT");
  assert.equal(calls[0].body.paymentMethod, "GOLIS");
  assert.equal("tableId" in calls[0].body, false);
});

test("receipt refresh failures are persistent and retryable", async () => {
  let failing = true;
  const request = {
    id: "p",
    payerName: "Test Customer",
    payerPhone: "1234567",
    amount: 18,
    paidAmount: 0,
    remainingAmount: 18,
    status: "PENDING",
  };
  const Component = component(
    "src/components/cashier/CashierPaymentDialog.tsx",
    async (_url, init) => {
      if (init?.method === "POST") return json({ requests: [request] });
      if (failing) return json({ error: "unavailable" }, 503);
      return json({ receipts: [], requests: [request], canManage: false });
    },
  );
  await mount(Component, {
    tableId: "t",
    tableName: "Table",
    amountDue: 18,
    showEqualSplit: false,
  });
  await click("Take payment");
  await input(document.querySelector("select"), "GOLIS");
  const fields = document.querySelectorAll('[role="dialog"] input');
  await input(fields[0], "Test Customer");
  await input(fields[1], "1234567");
  await click("Continue to receipts");
  assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Could not refresh/);
  failing = false;
  await click("Retry refresh");
  assert.equal(document.querySelector('[role="alert"]'), null);
});
