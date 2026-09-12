import assert from "node:assert/strict";
import test from "node:test";

import { parseTableMetadata } from "../../src/lib/tables/table-metadata";

test("normalizes table metadata", () => {
  assert.deepEqual(
    parseTableMetadata({
      name: "  Table 12 ",
      capacity: "6",
      section: " Outdoor ",
      isActive: "active",
    }),
    { name: "Table 12", capacity: 6, section: "Outdoor", isActive: true },
  );
});

test("accepts hidden tables", () => {
  assert.equal(
    parseTableMetadata({
      name: "Patio 1",
      capacity: 2,
      section: "Patio",
      isActive: "inactive",
    }).isActive,
    false,
  );
});

test("rejects invalid seating capacities", () => {
  for (const capacity of [0, 51, 2.5, "not-a-number"]) {
    assert.throws(
      () =>
        parseTableMetadata({
          name: "Table 1",
          capacity,
          section: "Main Floor",
        }),
      /whole number between 1 and 50/,
    );
  }
});

test("requires bounded names and sections", () => {
  assert.throws(
    () => parseTableMetadata({ name: "", capacity: 4, section: "Main" }),
    /Table name/,
  );
  assert.throws(
    () => parseTableMetadata({ name: "Table 1", capacity: 4, section: "" }),
    /Section/,
  );
});
