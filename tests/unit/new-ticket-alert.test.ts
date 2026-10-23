import assert from "node:assert/strict";
import test from "node:test";
import { unseenTicketIds } from "../../src/lib/kitchen/new-ticket-alert";

test("new ticket alert identifies only newly seen ids, including after queue reordering", () => {
  const seen = new Set(["old", "finished"]);
  assert.deepEqual(unseenTicketIds(seen, [{ id: "old" }, { id: "new" }]), [
    "new",
  ]);
  assert.deepEqual(
    unseenTicketIds(seen, [{ id: "finished" }, { id: "old" }]),
    [],
  );
  assert.deepEqual(
    unseenTicketIds(new Set(["new", "old"]), [{ id: "new" }, { id: "old" }]),
    [],
  );
});
