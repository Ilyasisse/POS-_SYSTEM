import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYROLL_ADJUSTMENT_PAGE_SIZE,
  payrollAdjustmentPage,
} from "../../src/lib/staff/payroll-adjustment-page";

test("payroll adjustment pages reach older pending records", () => {
  assert.deepEqual(
    payrollAdjustmentPage("2", PAYROLL_ADJUSTMENT_PAGE_SIZE + 4),
    {
      page: 2,
      pageCount: 2,
      skip: PAYROLL_ADJUSTMENT_PAGE_SIZE,
    },
  );
  assert.equal(payrollAdjustmentPage("999", 29).page, 2);
  assert.equal(payrollAdjustmentPage("-1", 29).page, 1);
  assert.equal(payrollAdjustmentPage("1.1", 29).page, 1);
  assert.deepEqual(payrollAdjustmentPage("10", 0), {
    page: 1,
    pageCount: 1,
    skip: 0,
  });
});
