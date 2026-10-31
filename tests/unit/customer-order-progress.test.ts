import assert from "node:assert/strict";
import test from "node:test";
import { customerOrderStage } from "../../src/lib/customer/customer-order-progress";
import { getCustomerOrderProgress } from "../../src/lib/customer/order-progress";

test("paid orders remain queued until kitchen work starts", () => {
  assert.equal(
    getCustomerOrderProgress({
      orderStatus: "PAID",
      pickupStatus: "PREPARING",
      stationStatuses: ["NEW", "NEW"],
    }).label,
    "Queued",
  );
});

test("partially completed and reopened orders remain preparing", () => {
  for (const orderStatus of ["OPEN", "PAID"] as const) {
    assert.equal(
      getCustomerOrderProgress({
        orderStatus,
        pickupStatus: "PREPARING",
        stationStatuses: ["DONE", "NEW"],
      }).label,
      "Preparing",
    );
  }
});

test("paid history without a kitchen ticket retains its payment status", () => {
  assert.equal(getCustomerOrderProgress({ orderStatus: "PAID" }).label, "Paid");
});

test("shows kitchen preparation and ready progress", () => {
  assert.equal(
    getCustomerOrderProgress({
      orderStatus: "OPEN",
      pickupStatus: "PREPARING",
      stationStatuses: ["NEW", "IN_PROGRESS"],
    }).label,
    "Preparing",
  );
  assert.equal(
    getCustomerOrderProgress({
      orderStatus: "OPEN",
      pickupStatus: "READY",
      stationStatuses: ["DONE"],
    }).label,
    "Ready",
  );
});

test("prioritizes terminal customer-visible states", () => {
  assert.equal(
    getCustomerOrderProgress({
      orderStatus: "CANCELLED",
      pickupStatus: "PREPARING",
    }).label,
    "Cancelled",
  );
  assert.equal(
    getCustomerOrderProgress({
      orderStatus: "PAID",
      pickupStatus: "DELIVERED",
    }).label,
    "Delivered",
  );
});

test("shows queued and finishing states", () => {
  assert.equal(
    getCustomerOrderProgress({ orderStatus: "OPEN" }).label,
    "Queued",
  );
  assert.equal(
    getCustomerOrderProgress({
      orderStatus: "OPEN",
      pickupStatus: "PREPARING",
      stationStatuses: ["DONE", "DONE"],
    }).label,
    "Finishing",
  );
});

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
