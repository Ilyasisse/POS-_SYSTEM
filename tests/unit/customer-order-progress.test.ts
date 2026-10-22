import assert from "node:assert/strict";
import test from "node:test";
import { customerOrderStage } from "../../src/lib/customer/customer-order-progress";
test("customer progress follows persisted kitchen state through handover", () => {
  assert.equal(customerOrderStage("REVIEW", null), "PAYMENT");
  assert.equal(customerOrderStage("PAYMENT_RECEIVED", null), "PAYMENT");
  assert.equal(
    customerOrderStage("PAID", {
      pickupStatus: "PREPARING",
      stationStates: [{ status: "NEW" }],
    }),
    "RECEIVED",
  );
  assert.equal(
    customerOrderStage("PAID", {
      pickupStatus: "PREPARING",
      stationStates: [{ status: "DONE" }, { status: "IN_PROGRESS" }],
    }),
    "PREPARING",
  );
  for (const [pickupStatus, expected] of [
    ["READY", "READY"],
    ["CLAIMED", "PICKED_UP"],
    ["DELIVERED", "DELIVERED"],
  ]) {
    assert.equal(
      customerOrderStage("PAID", { pickupStatus, stationStates: [] }),
      expected,
    );
  }
});
test("reopened kitchen work returns to preparing until every station is ready", () => {
  assert.equal(
    customerOrderStage("PAID", {
      pickupStatus: "PREPARING",
      stationStates: [{ status: "DONE" }, { status: "NEW" }],
    }),
    "PREPARING",
  );
});
