import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { planSupplierPaymentAllocations } from "../../src/lib/suppliers/payment-allocation";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const target = (
  billId: string,
  remaining: string,
  dueDate: string,
  installmentId: string | null = null,
  sequence = 0,
) => ({
  billId,
  invoiceId: `invoice-${billId}`,
  installmentId,
  dueDate: date(dueDate),
  sequence,
  billCreatedAt: date("2026-08-01"),
  remainingAmount: new Prisma.Decimal(remaining),
});

test("pays the selected target, then its invoice, then older open bills", () => {
  const result = planSupplierPaymentAllocations({
    amount: "125.00",
    preferredBillId: "selected",
    preferredInstallmentId: "selected-1",
    targets: [
      target("older", "30.00", "2026-08-02"),
      target("selected", "40.00", "2026-08-10", "selected-2", 2),
      target("selected", "50.00", "2026-08-05", "selected-1", 1),
    ],
  });
  assert.deepEqual(
    result.allocations.map((allocation) => [
      allocation.billId,
      allocation.installmentId,
      allocation.amount.toFixed(2),
    ]),
    [
      ["selected", "selected-1", "50.00"],
      ["selected", "selected-2", "40.00"],
      ["older", null, "30.00"],
    ],
  );
  assert.equal(result.unallocatedAmount.toFixed(2), "5.00");
});

test("a payment without invoices remains entirely as supplier credit", () => {
  const result = planSupplierPaymentAllocations({ amount: "75.25", targets: [] });
  assert.deepEqual(result.allocations, []);
  assert.equal(result.unallocatedAmount.toFixed(2), "75.25");
});

test("future credit application can partially or fully settle a target", () => {
  const partial = planSupplierPaymentAllocations({
    amount: "20.00",
    targets: [target("future", "35.00", "2026-09-01")],
  });
  assert.equal(partial.allocations[0].amount.toFixed(2), "20.00");
  assert.equal(partial.unallocatedAmount.toFixed(2), "0.00");

  const excess = planSupplierPaymentAllocations({
    amount: "50.00",
    targets: [target("future", "35.00", "2026-09-01")],
  });
  assert.equal(excess.allocations[0].amount.toFixed(2), "35.00");
  assert.equal(excess.unallocatedAmount.toFixed(2), "15.00");
});
