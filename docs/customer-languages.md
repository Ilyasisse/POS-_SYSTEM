# Customer languages

Customers can choose **English** or **Soomaali** on `/menu`, `/customer`, and the customer payment page. English is the default. The `cafe-customer-locale` preference cookie lasts one year and is shared between these routes. Server layouts validate it and render the chosen language immediately. Changing the selector updates the existing React tree without navigation, so the cart, quantities, search, and fulfillment stay intact. If the browser blocks cookies, switching still works on the current page.

This uses the `next-intl` translator behind a customer-only context. Shared cashier components fall back to English and hide the selector outside the customer layouts. No locale URL prefixes, redirects, auth changes, schema changes, or migrations are required.

## Mark text for translation

Add the same key to `src/i18n/messages/en.json` and `so.json`, then use it in a client component:

```tsx
const t = useCustomerTranslations();
return <button>{t("addToCart")}</button>;
```

Translate whole labels and sentences. Use ICU placeholders and plurals for changing values, for example `t("itemCount", { count })`. App-owned validation and draft messages can be stored as `{ key, values }` and rendered with `formatCustomerMessage` so they also update while visible.

Only marked interface text changes. Product/category names, descriptions, modifier names, customer and staff names, table names, payment codes, amounts, and server-provided error details retain their original data. Translation files are maintained by developers; there is no automatic translation service. The homepage and staff screens remain English.

## Validation

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` with the usual local environment. In environments that disallow the tsx CLI's local IPC socket, run the same suite using:

```sh
node --import tsx --test tests/unit/*.test.ts tests/integration/*.test.ts tests/integration/*.test.mjs tests/e2e/*.spec.ts
```

The language tests cover dictionary parity, ICU formatting, cookie validation, server-rendered labels, staff fallback, and live language switching with preserved state in a DOM. They also run in the customer-checkout GitHub workflow. These DOM tests do not replace a real-device check of sign-in and mobile-money payment.
