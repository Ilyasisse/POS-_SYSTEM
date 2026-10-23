import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedPayrollRunPage,
  payrollRunBrowserParams,
} from "../../src/lib/staff/payroll-run-browser";

test("payroll run browsing validates status and clamps pages to available results", () => {
  assert.deepEqual(payrollRunBrowserParams("APPROVED", "2"), {
    status: "APPROVED",
    page: 2,
  });
  assert.deepEqual(payrollRunBrowserParams("UNKNOWN", "-3"), {
    status: "ALL",
    page: 1,
  });
  assert.deepEqual(payrollRunBrowserParams("DRAFT", "Infinity"), {
    status: "DRAFT",
    page: 1,
  });
  assert.deepEqual(boundedPayrollRunPage(50, 25), { page: 3, pages: 3 });
  assert.deepEqual(boundedPayrollRunPage(2, 0), { page: 1, pages: 1 });
});
