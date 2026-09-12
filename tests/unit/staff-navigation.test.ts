import assert from "node:assert/strict";
import test from "node:test";
import type { Station, UserRole } from "@prisma/client";

import {
  getActiveStaffNavigationGroupKey,
  getNextOpenStaffNavigationGroupKey,
  getStaffNavigationNodesFromItems,
  getVisibleStaffNavigationItems,
  isStaffNavActive,
} from "../../src/components/staff/layout/staff-navigation";

function user(role: UserRole, station: Station | null = null) {
  return { role, station };
}

test("admin navigation is grouped in the intended order", () => {
  const items = getVisibleStaffNavigationItems(user("ADMIN"), "admin");
  const nodes = getStaffNavigationNodesFromItems(items);
  const dashboard = items.find((item) => item.key === "dashboard");

  assert.equal(dashboard?.href, "/admin");

  assert.deepEqual(
    nodes.map((node) => (node.type === "link" ? node.item.key : node.key)),
    [
      "dashboard",
      "catalog",
      "admin-operations",
      "suppliers",
      "reports",
      "administration",
    ],
  );
});

test("supplier routes stay together and include invoices and bills", () => {
  const items = getVisibleStaffNavigationItems(user("ADMIN"), "admin");
  const suppliers = getStaffNavigationNodesFromItems(items).find(
    (node) => node.type === "group" && node.key === "suppliers",
  );

  assert.ok(suppliers && suppliers.type === "group");
  assert.deepEqual(
    suppliers.items.map((item) => item.key),
    [
      "suppliers",
      "supplier-purchase-orders",
      "supplier-order-schedules",
      "supplier-invoices",
      "supplier-bills",
    ],
  );
});

test("customer profiles are grouped with reporting", () => {
  const items = getVisibleStaffNavigationItems(user("ADMIN"), "admin");
  const reports = getStaffNavigationNodesFromItems(items).find(
    (node) => node.type === "group" && node.key === "reports",
  );

  assert.ok(reports && reports.type === "group");
  assert.deepEqual(
    reports.items.map((item) => item.key),
    ["reports", "business-intelligence", "customers"],
  );
});

test("permission filtering removes inaccessible groups and children", () => {
  const cashierItems = getVisibleStaffNavigationItems(user("CASHIER"));
  const nodes = getStaffNavigationNodesFromItems(cashierItems);

  assert.equal(
    nodes.some((node) => node.type === "group" && node.key === "suppliers"),
    false,
  );
  assert.deepEqual(
    cashierItems.map((item) => item.key),
    ["cashier-home", "cashier-order", "cashier-waiter-orders"],
  );
});

test("station filtering keeps only the authorized kitchen destination", () => {
  const items = getVisibleStaffNavigationItems(user("COOK", "FAST_FOOD"));
  const kitchen = getStaffNavigationNodesFromItems(items).find(
    (node) => node.type === "group" && node.key === "kitchen",
  );

  assert.ok(kitchen && kitchen.type === "group");
  assert.deepEqual(
    kitchen.items.map((item) => item.key),
    ["kitchen-home", "kitchen-fast-food"],
  );
});

test("nested pages activate their parent navigation item", () => {
  const items = getVisibleStaffNavigationItems(user("ADMIN"), "admin");
  const nodes = getStaffNavigationNodesFromItems(items);
  const dashboard = items.find((item) => item.key === "dashboard");
  const invoices = items.find((item) => item.key === "supplier-invoices");

  assert.ok(dashboard);
  assert.equal(isStaffNavActive("/admin", dashboard), true);
  assert.equal(isStaffNavActive("/admin/categories", dashboard), false);
  assert.ok(invoices);
  assert.equal(
    isStaffNavActive("/admin/supplier-invoices/invoice-123", invoices),
    true,
  );
  assert.equal(
    getActiveStaffNavigationGroupKey(
      "/admin/supplier-invoices/invoice-123",
      nodes,
    ),
    "suppliers",
  );
  assert.equal(
    getActiveStaffNavigationGroupKey("/admin/categories", nodes),
    "catalog",
  );
  assert.equal(
    getActiveStaffNavigationGroupKey("/admin", nodes),
    null,
  );
});

test("selecting a group closes the previous group and toggles itself", () => {
  assert.equal(
    getNextOpenStaffNavigationGroupKey("catalog", "suppliers"),
    "suppliers",
  );
  assert.equal(
    getNextOpenStaffNavigationGroupKey("suppliers", "suppliers"),
    null,
  );
  assert.equal(
    getNextOpenStaffNavigationGroupKey(null, "administration"),
    "administration",
  );
});
