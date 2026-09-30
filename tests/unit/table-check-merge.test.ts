import assert from "node:assert/strict";
import test from "node:test";

import { buildMergedRoundAssignments } from "../../src/lib/cashier/table-check-merge";

test("appends source orders after the destination's highest round", () => {
  assert.deepEqual(buildMergedRoundAssignments(["round-a", "round-b"], 3), [
    { orderId: "round-a", tableCheckRound: 4 },
    { orderId: "round-b", tableCheckRound: 5 },
  ]);
});

test("starts at round one for an empty destination", () => {
  assert.deepEqual(buildMergedRoundAssignments(["round-a"], 0), [
    { orderId: "round-a", tableCheckRound: 1 },
  ]);
});

test("rejects invalid round state and duplicate source orders", () => {
  assert.throws(() => buildMergedRoundAssignments(["round-a"], -1), /non-negative/);
  assert.throws(
    () => buildMergedRoundAssignments(["round-a", "round-a"], 2),
    /unique/,
  );
});
