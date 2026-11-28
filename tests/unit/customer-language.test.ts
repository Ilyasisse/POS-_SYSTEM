import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import en from "../../src/i18n/messages/en.json";
import so from "../../src/i18n/messages/so.json";
import {
  CUSTOMER_LOCALES,
  createCustomerTranslator,
  customerLocaleCookie,
  formatCustomerMessage,
  resolveCustomerLocale,
  type CustomerMessage,
  type CustomerMessageKey,
} from "../../src/i18n/customer";
import {
  CustomerLanguageProvider,
  CustomerLanguageSelect,
} from "../../src/components/customer/i18n/CustomerLanguageProvider";
import MenuBrowserPanel from "../../src/components/customer/UI/MenuBrowserPanel";
import CustomerProductGrid from "../../src/components/customer/CustomerProductGrid";
import { customerUssdCode } from "../../src/lib/payments/customer-ussd";

test("only supported cookie locales are accepted, with English as the default", () => {
  for (const value of [undefined, null, "", "ar", "SO", "../../so", "so; Path=/"]) {
    assert.equal(resolveCustomerLocale(value), "en");
  }
  assert.equal(resolveCustomerLocale("en"), "en");
  assert.equal(resolveCustomerLocale("so"), "so");
  assert.equal(
    customerLocaleCookie("so", false),
    "cafe-customer-locale=so; Path=/; Max-Age=31536000; SameSite=Lax",
  );
  assert.match(customerLocaleCookie("en", true), /; Secure$/);
});

test("both dictionaries cover every key and format all ICU messages", () => {
  assert.deepEqual(Object.keys(so).sort(), Object.keys(en).sort());
  for (const locale of CUSTOMER_LOCALES) {
    const t = createCustomerTranslator(locale);
    for (const key of Object.keys(en) as CustomerMessageKey[]) {
      const text = t(key, {
        count: 2,
        min: 1,
        max: 3,
        name: "Tea",
        category: "Drinks",
        number: 273,
        stage: "Ready",
        table: "Table 4",
        phone: "901234567",
      });
      assert.ok(text && text !== key, `${locale}.${key} must resolve`);
      assert.doesNotMatch(text, /\{(?:count|min|max|name|category|number|stage|table|phone)\}/);
    }
  }
  assert.equal(createCustomerTranslator("en")("itemCount", { count: 1 }), "1 item");
  assert.equal(createCustomerTranslator("en")("itemCount", { count: 2 }), "2 items");
  assert.equal(createCustomerTranslator("so")("itemCount", { count: 2 }), "2 shay");
});

test("validation and restored draft messages can change language after being stored", () => {
  const messages: CustomerMessage = [
    { key: "phoneInvalid" },
    { key: "draftRemoved", values: { count: 2 } },
  ];
  assert.match(
    formatCustomerMessage(messages, createCustomerTranslator("en")),
    /nine digits.*2 unavailable/,
  );
  assert.match(
    formatCustomerMessage(messages, createCustomerTranslator("so")),
    /sagaal lambar.*2 shay/,
  );
  assert.equal(
    formatCustomerMessage("A server-provided detail", createCustomerTranslator("so")),
    "A server-provided detail",
  );
});

const menu = () =>
  createElement(MenuBrowserPanel, {
    key: "menu",
    searchTerm: "coffee",
    categoryChips: [
      { id: "all", name: "All", count: 2 },
      { id: "drinks", name: "House Drinks", count: 1 },
    ],
    selectedCategory: "all",
    onSearchChange() {},
    onCategorySelect() {},
  });

test("customer content renders in the saved language on the server without translating catalog data", () => {
  const html = renderToStaticMarkup(
    createElement(
      CustomerLanguageProvider,
      { initialLocale: "so" },
      createElement(CustomerLanguageSelect),
      menu(),
    ),
  );
  assert.match(html, /lang="so"/);
  assert.match(html, /Luqadda/);
  assert.match(html, /Dhammaan/);
  assert.match(html, /2 shay/);
  assert.match(html, /House Drinks/);
  assert.match(html, /value="coffee"/);
  assert.match(html, /value="so"[^>]*selected/);
});

test("shared cashier menu components stay English and do not show a customer selector", () => {
  const html = renderToStaticMarkup(menu());
  assert.match(html, /Browse by category/);
  assert.match(html, /2 items/);
  assert.equal(renderToStaticMarkup(createElement(CustomerLanguageSelect)), "");
});

test("empty-search text translates as a whole sentence and payment codes are unchanged", () => {
  const html = renderToStaticMarkup(
    createElement(
      CustomerLanguageProvider,
      { initialLocale: "so" },
      createElement(CustomerProductGrid, {
        loading: false,
        products: [],
        baristas: [],
        selectedCategoryName: "House Drinks",
        onProductClick() {},
      }),
    ),
  );
  assert.match(html, /Wax raadin kuu dhigma lagama helin House Drinks\./);
  for (const locale of CUSTOMER_LOCALES) {
    const t = createCustomerTranslator(locale);
    assert.match(t("payerInstruction", { phone: "901234567" }), /901234567/);
    assert.equal(customerUssdCode(12.5), "*884*430935*12.50#");
  }
});
