import assert from "node:assert/strict";
import test from "node:test";
import {
  complaintAssignmentInput,
  complaintInput,
  complaintResolutionInput,
} from "../../src/lib/customer/complaint-input";

test("complaint creation requires a meaningful description and valid category", () => {
  assert.equal(
    complaintInput.safeParse({
      category: "FOOD",
      priority: "HIGH",
      description: "Cold coffee served",
      orderId: "",
    }).success,
    true,
  );
  assert.equal(
    complaintInput.safeParse({
      category: "FAKE",
      priority: "HIGH",
      description: "Cold coffee served",
      orderId: "",
    }).success,
    false,
  );
  assert.equal(
    complaintInput.safeParse({
      category: "FOOD",
      priority: "HIGH",
      description: "short",
      orderId: "",
    }).success,
    false,
  );
});

test("assignment and resolution require IDs and a resolution note", () => {
  assert.equal(
    complaintAssignmentInput.safeParse({ complaintId: "x", assigneeId: "" })
      .success,
    false,
  );
  assert.equal(
    complaintResolutionInput.safeParse({
      complaintId: "x",
      resolutionNotes: "Fixed the issue",
    }).success,
    true,
  );
  assert.equal(
    complaintResolutionInput.safeParse({
      complaintId: "x",
      resolutionNotes: "done",
    }).success,
    false,
  );
});
