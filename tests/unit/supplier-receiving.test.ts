import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveryDifference,
  validateReceivedQuantities,
} from "../../src/lib/suppliers/receiving";

const ordered = [
  { id: "rice", quantity: "5.000" },
  { id: "milk", quantity: "2.500" },
];

test("records complete matching quantities without a variance", () => {
  const result = validateReceivedQuantities(ordered, [
    { id: "milk", quantity: "2.5" },
    { id: "rice", quantity: "5" },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.hasDifference, false);
    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["rice", "milk"],
    );
  }
});

test("supports zero deliveries, fractional counts and over-deliveries", () => {
  const result = validateReceivedQuantities(ordered, [
    { id: "rice", quantity: "0" },
    { id: "milk", quantity: "3.125" },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.hasDifference, true);
  assert.deepEqual(deliveryDifference("5", "0"), {
    status: "Short",
    quantity: "5.000",
  });
  assert.deepEqual(deliveryDifference("2.5", "3.125"), {
    status: "Extra",
    quantity: "0.625",
  });
  assert.deepEqual(deliveryDifference("2.5", "2.5"), {
    status: "Matched",
    quantity: "0.000",
  });
});

test("rejects missing, repeated, or unrecognized rows", () => {
  for (const rows of [
    [{ id: "rice", quantity: "1" }],
    [
      { id: "rice", quantity: "1" },
      { id: "rice", quantity: "2" },
    ],
    [
      { id: "rice", quantity: "1" },
      { id: "other", quantity: "2" },
    ],
  ])
    assert.equal(validateReceivedQuantities(ordered, rows).ok, false);
});

test("rejects negative, excessive, or over-precise quantities", () => {
  for (const quantity of ["-1", "1.2345", "1e3", "999999999999", "NaN", "  "]) {
    assert.equal(
      validateReceivedQuantities(ordered, [
        { id: "rice", quantity },
        { id: "milk", quantity: "1" },
      ]).ok,
      false,
    );
  }
});
