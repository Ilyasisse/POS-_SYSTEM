import assert from "node:assert/strict";
import test from "node:test";
import { getCustomerOrderProgress } from "../../src/lib/customer/order-progress";

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
