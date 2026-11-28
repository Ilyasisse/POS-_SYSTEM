import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCustomerLookup,
  resolveTableCustomer,
} from "../../src/lib/cashier/table-customer";

test("validates an optional registered-customer email or exact phone", () => {
  assert.deepEqual(parseCustomerLookup("  ILYAS@EXAMPLE.COM "), {
    kind: "email",
    value: "ilyas@example.com",
  });
  assert.deepEqual(parseCustomerLookup("+252907123456"), {
    kind: "phone",
    value: "+252907123456",
  });
  assert.deepEqual(parseCustomerLookup("  "), { kind: "none" });
  for (const bad of [{}, "a@b", "12", "+252 90 123", "a".repeat(255)]) {
    assert.deepEqual(parseCustomerLookup(bad), { kind: "invalid" });
  }
});

test("keeps customer attribution consistent across rounds on an open check", () => {
  assert.deepEqual(resolveTableCustomer(false, null, "customer-1"), {
    customerId: "customer-1",
  });
  assert.deepEqual(resolveTableCustomer(true, "customer-1", null), {
    customerId: "customer-1",
  });
  assert.deepEqual(resolveTableCustomer(true, "customer-1", "customer-1"), {
    customerId: "customer-1",
  });
  assert.match(
    resolveTableCustomer(true, null, "customer-1").error ?? "",
    /open check/,
  );
  assert.match(
    resolveTableCustomer(true, "customer-1", "customer-2").error ?? "",
    /open check/,
  );
});
