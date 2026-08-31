import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";
import { canViewOrderReceipt } from "../../src/lib/orders/receipt-access";

const user = (id: string, role: UserRole) => ({ id, role, station: null });
const order = {
  customerId: "customer-1",
  waiterId: "waiter-1",
  cashierId: "cashier-1",
};

test("customers can view only their own receipts", () => {
  assert.equal(canViewOrderReceipt(user("customer-1", "CUSTOMER"), order), true);
  assert.equal(canViewOrderReceipt(user("customer-2", "CUSTOMER"), order), false);
});

test("assigned waiters and cashiers can view their order receipts", () => {
  assert.equal(canViewOrderReceipt(user("waiter-1", "WAITER"), order), true);
  assert.equal(canViewOrderReceipt(user("waiter-2", "WAITER"), order), false);
  assert.equal(canViewOrderReceipt(user("cashier-1", "CASHIER"), order), true);
});

test("users with all-order access can view any receipt", () => {
  assert.equal(canViewOrderReceipt(user("admin-1", "ADMIN"), order), true);
  assert.equal(canViewOrderReceipt(user("manager-1", "MANAGER"), order), true);
});
