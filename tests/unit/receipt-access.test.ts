import { expect, test } from "@jest/globals";

import type { UserRole } from "@prisma/client";
import { canViewOrderReceipt } from "../../src/lib/orders/receipt-access";

const user = (id: string, role: UserRole) => ({ id, role, station: null });
const order = {
  customerId: "customer-1",
  waiterId: "waiter-1",
  cashierId: "cashier-1",
};

test("customers can view only their own receipts", () => {
  expect(canViewOrderReceipt(user("customer-1", "CUSTOMER"), order)).toBe(true);
  expect(canViewOrderReceipt(user("customer-2", "CUSTOMER"), order)).toBe(false);
});

test("assigned waiters and cashiers can view their order receipts", () => {
  expect(canViewOrderReceipt(user("waiter-1", "WAITER"), order)).toBe(true);
  expect(canViewOrderReceipt(user("waiter-2", "WAITER"), order)).toBe(false);
  expect(canViewOrderReceipt(user("cashier-1", "CASHIER"), order)).toBe(true);
});

test("users with all-order access can view any receipt", () => {
  expect(canViewOrderReceipt(user("admin-1", "ADMIN"), order)).toBe(true);
  expect(canViewOrderReceipt(user("manager-1", "MANAGER"), order)).toBe(true);
});
