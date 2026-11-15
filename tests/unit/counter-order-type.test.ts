import { expect, test } from "@jest/globals";

import { parseCounterOrderType } from "../../src/lib/orders/counter-order-type";

test("counter sales accept takeaway orders", () => {
  expect(parseCounterOrderType("TAKEOUT")).toBe("TAKEOUT");
  expect(parseCounterOrderType(undefined)).toBe("TAKEOUT");
});

test("counter sales reject table and unsupported order types", () => {
  expect(parseCounterOrderType("DINE_IN")).toBe(null);
  expect(parseCounterOrderType("DELIVERY")).toBe(null);
});
