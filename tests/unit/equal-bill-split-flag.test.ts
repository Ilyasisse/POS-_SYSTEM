import { expect, test } from "@jest/globals";

import { canShowEqualBillSplit } from "../../src/lib/payments/equal-bill-split-flag";

test("equal bill splitting is visible only to admins with the PostHog flag", async () => {
  const admin = { id: "admin-1", role: "ADMIN" };
  expect(await canShowEqualBillSplit(admin, async () => true)).toBe(true);
  expect(await canShowEqualBillSplit(admin, async () => false)).toBe(false);
});

test("non-admin roles never evaluate or see the flag", async () => {
  for (const role of ["CASHIER", "MANAGER", "WAITER", "CUSTOMER"]) {
    let evaluations = 0;
    const visible = await canShowEqualBillSplit({ id: role, role }, async () => {
      evaluations += 1;
      return true;
    });
    expect(visible).toBe(false);
    expect(evaluations).toBe(0);
  }
});

test("flag failures hide equal bill splitting", async () => {
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const visible = await canShowEqualBillSplit({ id: "admin-1", role: "ADMIN" }, async () => {
      throw new Error("PostHog unavailable");
    });
    expect(visible).toBe(false);
  } finally {
    console.error = originalError;
  }
});
