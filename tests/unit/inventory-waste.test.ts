import assert from "node:assert/strict";
import test from "node:test";
import {
  wasteInputSchema,
  wasteStatusAlert,
} from "../../src/lib/inventory/waste-input";

test("requires a reason and valid loss type and preserves six-place quantities", () => {
  assert.equal(
    wasteInputSchema.parse({
      supplyId: "s",
      type: "SPOILAGE",
      quantity: "0.000001",
      reason: "Expired",
    }).quantity,
    "0.000001",
  );
  for (const quantity of ["0", "-1", "0.0000001", "1e6", "1000000000000"]) {
    assert.equal(
      wasteInputSchema.safeParse({
        supplyId: "s",
        type: "WASTE",
        quantity,
        reason: "Expired",
      }).success,
      false,
    );
  }
  assert.equal(
    wasteInputSchema.safeParse({
      supplyId: "s",
      type: "SALE_USAGE",
      quantity: "1",
      reason: "Expired",
    }).success,
    false,
  );
  assert.equal(
    wasteInputSchema.safeParse({
      supplyId: "s",
      type: "WASTE",
      quantity: "1",
      reason: "no",
    }).success,
    false,
  );
});

test("only alert when a loss enters a new low or out status", () => {
  assert.equal(wasteStatusAlert("OK", "LOW"), true);
  assert.equal(wasteStatusAlert("LOW", "OUT"), true);
  assert.equal(wasteStatusAlert("OUT", "OUT"), false);
});
