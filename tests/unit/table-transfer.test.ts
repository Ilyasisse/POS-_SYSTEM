import assert from "node:assert/strict";
import test from "node:test";
import { assertTableTransferAllowed } from "../../src/lib/cashier/table-transfer-validation";

const valid = {
  sourceTableId: "table-1",
  targetTableId: "table-2",
  sourceExists: true,
  targetExists: true,
  sourceOpenOrderCount: 2,
  targetOpenOrderCount: 0,
};

test("allows moving open service to an available table", () => {
  assert.doesNotThrow(() => assertTableTransferAllowed(valid));
});

test("rejects occupied destinations and stale source tables", () => {
  assert.throws(
    () => assertTableTransferAllowed({ ...valid, targetOpenOrderCount: 1 }),
    /already occupied/,
  );
  assert.throws(
    () => assertTableTransferAllowed({ ...valid, sourceOpenOrderCount: 0 }),
    /no longer has an open order/,
  );
});

test("rejects inactive, missing, or identical tables", () => {
  assert.throws(
    () => assertTableTransferAllowed({ ...valid, targetExists: false }),
    /must be active/,
  );
  assert.throws(
    () =>
      assertTableTransferAllowed({
        ...valid,
        targetTableId: valid.sourceTableId,
      }),
    /different destination/,
  );
});
