import { expect, test } from "@jest/globals";

import { customerOrderStage } from "../../src/lib/customer/customer-order-progress";
import { getCustomerOrderProgress } from "../../src/lib/customer/order-progress";

test("paid orders remain queued until kitchen work starts", () => {
  expect(
    getCustomerOrderProgress({
      orderStatus: "PAID",
      pickupStatus: "PREPARING",
      stationStatuses: ["NEW", "NEW"],
    }).label,
  ).toBe("Queued");
});

test("partially completed and reopened orders remain preparing", () => {
  for (const orderStatus of ["OPEN", "PAID"] as const) {
    expect(
      getCustomerOrderProgress({
        orderStatus,
        pickupStatus: "PREPARING",
        stationStatuses: ["DONE", "NEW"],
      }).label,
    ).toBe("Preparing");
  }
});

test("paid history without a kitchen ticket retains its payment status", () => {
  expect(getCustomerOrderProgress({ orderStatus: "PAID" }).label).toBe("Paid");
});

test("shows kitchen preparation and ready progress", () => {
  expect(
    getCustomerOrderProgress({
      orderStatus: "OPEN",
      pickupStatus: "PREPARING",
      stationStatuses: ["NEW", "IN_PROGRESS"],
    }).label,
  ).toBe("Preparing");
  expect(
    getCustomerOrderProgress({
      orderStatus: "OPEN",
      pickupStatus: "READY",
      stationStatuses: ["DONE"],
    }).label,
  ).toBe("Ready");
});

test("prioritizes terminal customer-visible states", () => {
  expect(
    getCustomerOrderProgress({
      orderStatus: "CANCELLED",
      pickupStatus: "PREPARING",
    }).label,
  ).toBe("Cancelled");
  expect(
    getCustomerOrderProgress({
      orderStatus: "PAID",
      pickupStatus: "DELIVERED",
    }).label,
  ).toBe("Delivered");
});

test("shows queued and finishing states", () => {
  expect(getCustomerOrderProgress({ orderStatus: "OPEN" }).label).toBe("Queued");
  expect(
    getCustomerOrderProgress({
      orderStatus: "OPEN",
      pickupStatus: "PREPARING",
      stationStatuses: ["DONE", "DONE"],
    }).label,
  ).toBe("Finishing");
});

test("customer progress follows persisted kitchen state through handover", () => {
  expect(customerOrderStage("REVIEW", null)).toBe("PAYMENT");
  expect(customerOrderStage("PAYMENT_RECEIVED", null)).toBe("PAYMENT");
  expect(
    customerOrderStage("PAID", {
      pickupStatus: "PREPARING",
      stationStates: [{ status: "NEW" }],
    }),
  ).toBe("RECEIVED");
  expect(
    customerOrderStage("PAID", {
      pickupStatus: "PREPARING",
      stationStates: [{ status: "DONE" }, { status: "IN_PROGRESS" }],
    }),
  ).toBe("PREPARING");
  for (const [pickupStatus, expected] of [
    ["READY", "READY"],
    ["CLAIMED", "PICKED_UP"],
    ["DELIVERED", "DELIVERED"],
  ]) {
    expect(customerOrderStage("PAID", { pickupStatus, stationStates: [] })).toBe(expected);
  }
});
test("reopened kitchen work returns to preparing until every station is ready", () => {
  expect(
    customerOrderStage("PAID", {
      pickupStatus: "PREPARING",
      stationStates: [{ status: "DONE" }, { status: "NEW" }],
    }),
  ).toBe("PREPARING");
});
