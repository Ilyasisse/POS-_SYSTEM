import assert from "node:assert/strict";
import test from "node:test";
import type { Station, UserRole } from "@prisma/client";
import {
  canAccessOrder,
  canAccessStation,
  hasPermission,
  PERMISSIONS,
  type PermissionUser,
} from "../../src/lib/auth/permissions";

function user(
  role: UserRole,
  station: Station | null = null,
  id: string = role,
): PermissionUser {
  return { id, role, station };
}

test("admin receives every permission", () => {
  const admin = user("ADMIN");
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(hasPermission(admin, permission), true);
  }
});

test("operational roles receive only their required capabilities", () => {
  assert.equal(hasPermission(user("CASHIER"), PERMISSIONS.PAYMENT_TAKE), true);
  assert.equal(
    hasPermission(user("CASHIER"), PERMISSIONS.SETTINGS_MANAGE),
    false,
  );
  assert.equal(
    hasPermission(user("WAITER"), PERMISSIONS.ORDER_VIEW_ASSIGNED),
    true,
  );
  assert.equal(
    hasPermission(user("WAITER"), PERMISSIONS.ORDER_VIEW_ALL),
    false,
  );
  assert.equal(
    hasPermission(user("SUPPLIER"), PERMISSIONS.SUPPLIER_MANAGE),
    false,
  );
  assert.equal(
    hasPermission(user("MANAGER"), PERMISSIONS.SUPPLIER_MANAGE),
    true,
  );
  assert.equal(
    hasPermission(user("MANAGER"), PERMISSIONS.WAITER_BALANCE_ADMIN),
    false,
  );
  assert.equal(
    hasPermission(user("MANAGER"), PERMISSIONS.SUPPLY_MANAGE),
    false,
  );
  assert.equal(
    hasPermission(user("CLEANER"), PERMISSIONS.TABLE_RESET_ASSIGNED),
    true,
  );
  assert.equal(
    hasPermission(user("CUSTOMER"), PERMISSIONS.CUSTOMER_ORDER),
    true,
  );
  for (const role of ["CASHIER", "WAITER", "COOK", "BARISTA", "Cabitaan", "CLEANER"] as const) {
    assert.equal(hasPermission(user(role), PERMISSIONS.ATTENDANCE_RECORD), true);
  }
});

test("kitchen users are restricted to their effective station", () => {
  assert.equal(
    canAccessStation(user("COOK", "FAST_FOOD"), ["FAST_FOOD"]),
    true,
  );
  assert.equal(
    canAccessStation(user("COOK", "FAST_FOOD"), ["CUNTO_SOOMAALI"]),
    false,
  );
  assert.equal(canAccessStation(user("BARISTA"), ["BARISTA"]), true);
  assert.equal(canAccessStation(user("Cabitaan"), ["CABITAAN"]), true);
  assert.equal(canAccessStation(user("ADMIN"), ["BARISTA"]), true);
});

test("waiters can access only orders assigned to them", () => {
  const waiter = user("WAITER", null, "waiter-1");
  assert.equal(
    canAccessOrder(waiter, { waiterId: "waiter-1", cashierId: null }),
    true,
  );
  assert.equal(
    canAccessOrder(waiter, { waiterId: "waiter-2", cashierId: null }),
    false,
  );
  assert.equal(
    canAccessOrder(user("MANAGER"), {
      waiterId: "waiter-2",
      cashierId: null,
    }),
    true,
  );
});
