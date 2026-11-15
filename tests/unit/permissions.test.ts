import { expect, test } from "@jest/globals";

import type { Station, UserRole } from "@prisma/client";
import {
  canAccessOrder,
  canAccessStation,
  hasPermission,
  PERMISSIONS,
  type PermissionUser,
} from "../../src/lib/auth/permissions";

function user(role: UserRole, station: Station | null = null, id: string = role): PermissionUser {
  return { id, role, station };
}

test("admin receives every permission", () => {
  const admin = user("ADMIN");
  for (const permission of Object.values(PERMISSIONS)) {
    expect(hasPermission(admin, permission)).toBe(true);
  }
});

test("operational roles receive only their required capabilities", () => {
  expect(hasPermission(user("CASHIER"), PERMISSIONS.PAYMENT_TAKE)).toBe(true);
  expect(hasPermission(user("CASHIER"), PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  expect(hasPermission(user("WAITER"), PERMISSIONS.ORDER_VIEW_ASSIGNED)).toBe(true);
  expect(hasPermission(user("WAITER"), PERMISSIONS.ORDER_VIEW_ALL)).toBe(false);
  expect(hasPermission(user("SUPPLIER"), PERMISSIONS.SUPPLIER_MANAGE)).toBe(false);
  expect(hasPermission(user("MANAGER"), PERMISSIONS.SUPPLIER_MANAGE)).toBe(true);
  expect(hasPermission(user("MANAGER"), PERMISSIONS.WAITER_BALANCE_ADMIN)).toBe(false);
  expect(hasPermission(user("MANAGER"), PERMISSIONS.SUPPLY_MANAGE)).toBe(false);
  expect(hasPermission(user("CLEANER"), PERMISSIONS.TABLE_RESET_ASSIGNED)).toBe(true);
  expect(hasPermission(user("CUSTOMER"), PERMISSIONS.CUSTOMER_ORDER)).toBe(true);
});

test("kitchen users are restricted to their effective station", () => {
  expect(canAccessStation(user("COOK", "FAST_FOOD"), ["FAST_FOOD"])).toBe(true);
  expect(canAccessStation(user("COOK", "FAST_FOOD"), ["CUNTO_SOOMAALI"])).toBe(false);
  expect(canAccessStation(user("BARISTA"), ["BARISTA"])).toBe(true);
  expect(canAccessStation(user("Cabitaan"), ["CABITAAN"])).toBe(true);
  expect(canAccessStation(user("ADMIN"), ["BARISTA"])).toBe(true);
});

test("waiters can access only orders assigned to them", () => {
  const waiter = user("WAITER", null, "waiter-1");
  expect(canAccessOrder(waiter, { waiterId: "waiter-1", cashierId: null })).toBe(true);
  expect(canAccessOrder(waiter, { waiterId: "waiter-2", cashierId: null })).toBe(false);
  expect(
    canAccessOrder(user("MANAGER"), {
      waiterId: "waiter-2",
      cashierId: null,
    }),
  ).toBe(true);
});
