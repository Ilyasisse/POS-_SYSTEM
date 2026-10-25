import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";

// Import ReactDOM and components after installing the DOM, as in a browser.
test("switching languages preserves live menu state, persists the choice, and restores staff language", async () => {
  const window = new Window({ url: "https://cafe.example/customer" });
  const properties = {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(properties)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { act, createElement: h, useState } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { CustomerLanguageProvider, CustomerLanguageSelect, useCustomerTranslations } =
    await import("../../src/components/customer/i18n/CustomerLanguageProvider");
  const { default: MenuBrowserPanel } =
    await import("../../src/components/customer/UI/MenuBrowserPanel");
  const { formatCustomerMessage } = await import("../../src/i18n/customer");
  window.document.documentElement.lang = "en";
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);

  function OrderingState() {
    const t = useCustomerTranslations();
    const [count, setCount] = useState(1);
    const [search, setSearch] = useState("coffee");
    return h(
      "div",
      null,
      h(CustomerLanguageSelect),
      h("button", { onClick: () => setCount((value) => value + 1) }, t("addToCart")),
      h("output", null, t("itemCount", { count })),
      h("p", { role: "alert" }, formatCustomerMessage({ key: "phoneInvalid" }, t)),
      h(MenuBrowserPanel, {
        searchTerm: search,
        onSearchChange: setSearch,
        categoryChips: [{ id: "all", name: "All", count: 3 }],
        selectedCategory: "all",
        onCategorySelect() {},
      }),
    );
  }

  try {
    await act(async () =>
      root.render(h(CustomerLanguageProvider, { initialLocale: "en" }, h(OrderingState))),
    );
    await act(async () => container.querySelector("button")!.click());
    assert.equal(container.querySelector("output")!.textContent, "2 items");
    const selector = container.querySelector("select")!;
    await act(async () => {
      selector.value = "so";
      selector.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(container.querySelector("output")!.textContent, "2 shay");
    assert.equal(container.querySelector("input")!.value, "coffee");
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /sagaal lambar/);
    assert.match(window.document.cookie, /cafe-customer-locale=so/);
    assert.equal(window.document.documentElement.lang, "so");
    await act(async () => {
      selector.value = "en";
      selector.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(container.querySelector("output")!.textContent, "2 items");
    assert.match(window.document.cookie, /cafe-customer-locale=en/);
    Object.defineProperty(window.document, "cookie", {
      configurable: true,
      set() {
        throw new Error("Cookies blocked");
      },
    });
    await act(async () => {
      selector.value = "so";
      selector.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(container.querySelector("output")!.textContent, "2 shay");
    Reflect.deleteProperty(window.document, "cookie");
    await act(async () => root.unmount());
    assert.equal(window.document.documentElement.lang, "en");
    // A fresh page receives the cookie locale from its server layout.
    const reload = createRoot(container as unknown as HTMLElement);
    await act(async () =>
      reload.render(h(CustomerLanguageProvider, { initialLocale: "so" }, h(OrderingState))),
    );
    assert.equal(container.querySelector("select")!.value, "so");
    assert.equal(container.querySelector("output")!.textContent, "1 shay");
    await act(async () => reload.unmount());
    assert.equal(window.document.documentElement.lang, "en");
  } finally {
    await window.happyDOM.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
