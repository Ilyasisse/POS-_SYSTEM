import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveProductBasePrice } from "../../src/lib/catalog/open-price";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("fixed-price products ignore client-supplied price overrides", () => {
  assert.deepEqual(
    resolveProductBasePrice({
      isOpenPrice: false,
      catalogPrice: 6.5,
      submittedPrice: 0.01,
    }),
    { ok: true, basePrice: 6.5, overridden: false },
  );
});

test("open-priced products accept and round a valid cashier price", () => {
  assert.deepEqual(
    resolveProductBasePrice({
      isOpenPrice: true,
      catalogPrice: 0,
      submittedPrice: "12.345",
    }),
    { ok: true, basePrice: 12.35, overridden: true },
  );
});

test("open-priced products reject missing, unsafe, and out-of-range prices", () => {
  for (const submittedPrice of [undefined, "", 0, -1, Number.NaN, 10_000.01]) {
    const result = resolveProductBasePrice({
      isOpenPrice: true,
      catalogPrice: 0,
      submittedPrice,
    });
    assert.equal(result.ok, false, `expected ${String(submittedPrice)} to fail`);
  }
});

test("table ordering validates overrides and audits accepted open prices", () => {
  const route = source("src/app/api/orders/table/route.ts");
  assert.match(route, /unitPriceOverride\?: number/);
  assert.match(route, /resolveProductBasePrice/);
  assert.match(route, /order\.open_price\.recorded/);
});

test("customer self-ordering hides and rejects open-priced products", () => {
  const page = source("src/components/customer/CustomerOrderPage.tsx");
  const route = source("src/app/api/customer/orders/route.ts");
  assert.match(page, /filter\(\(product\) => !product\.isOpenPrice\)/);
  assert.match(route, /must be priced by a cashier/);
});

test("cart identity includes the entered price for open-priced products", () => {
  const cart = source("src/hooks/waiter/useWaiterCart.ts");
  assert.match(cart, /product\.isOpenPrice/);
  assert.match(cart, /Number\(product\.price \?\? 0\)\.toFixed\(2\)/);
  assert.match(cart, /FIXED_PRICE/);
});
