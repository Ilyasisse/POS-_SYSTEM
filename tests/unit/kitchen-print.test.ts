import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKitchenPrintHref,
  kitchenStationLabel,
} from "../../src/lib/kitchen/kitchen-print";

test("builds full and station-specific kitchen ticket links", () => {
  assert.equal(buildKitchenPrintHref("order 1"), "/print/kitchen/order%201");
  assert.equal(
    buildKitchenPrintHref("order-1", "FAST_FOOD"),
    "/print/kitchen/order-1?station=FAST_FOOD",
  );
});

test("formats kitchen station labels for printed tickets", () => {
  assert.equal(kitchenStationLabel("CUNTO_SOOMAALI"), "Cunto Soomaali");
  assert.equal(kitchenStationLabel("CABITAAN"), "Cabitaan");
});
