import { expect, test } from "@jest/globals";

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

  expect(dashboard?.href).toBe("/admin");

  expect(nodes.map((node) => (node.type === "link" ? node.item.key : node.key))).toStrictEqual([
    "dashboard",
    "catalog",
    "admin-operations",
    "suppliers",
    "reports",
    "administration",
  ]);
});

test("supplier routes stay together and include invoices and bills", () => {
  const items = getVisibleStaffNavigationItems(user("ADMIN"), "admin");
  const suppliers = getStaffNavigationNodesFromItems(items).find(
    (node) => node.type === "group" && node.key === "suppliers",
  );

  expect(suppliers && suppliers.type === "group").toBeTruthy();
  if (!suppliers || suppliers.type !== "group") throw new Error("Expected suppliers group");
  expect(suppliers.items.map((item) => item.key)).toStrictEqual([
    "suppliers",
    "supplier-purchase-orders",
    "supplier-order-schedules",
    "supplier-invoices",
    "supplier-bills",
  ]);
});

test("customer profiles are grouped with reporting", () => {
  const items = getVisibleStaffNavigationItems(user("ADMIN"), "admin");
  const reports = getStaffNavigationNodesFromItems(items).find(
    (node) => node.type === "group" && node.key === "reports",
  );

  expect(reports && reports.type === "group").toBeTruthy();
  if (!reports || reports.type !== "group") throw new Error("Expected reports group");
  expect(reports.items.map((item) => item.key)).toStrictEqual([
    "reports",
    "business-intelligence",
    "customers",
  ]);
});

test("permission filtering removes inaccessible groups and children", () => {
  const cashierItems = getVisibleStaffNavigationItems(user("CASHIER"));
  const nodes = getStaffNavigationNodesFromItems(cashierItems);

  expect(nodes.some((node) => node.type === "group" && node.key === "suppliers")).toBe(false);
  expect(cashierItems.map((item) => item.key)).toStrictEqual([
    "cashier-home",
    "cashier-order",
    "cashier-waiter-orders",
    "customer-checkouts",
  ]);
});

test("station filtering keeps only the authorized kitchen destination", () => {
  const items = getVisibleStaffNavigationItems(user("COOK", "FAST_FOOD"));
  const kitchen = getStaffNavigationNodesFromItems(items).find(
    (node) => node.type === "group" && node.key === "kitchen",
  );

  expect(kitchen && kitchen.type === "group").toBeTruthy();
  if (!kitchen || kitchen.type !== "group") throw new Error("Expected kitchen group");
  expect(kitchen.items.map((item) => item.key)).toStrictEqual([
    "kitchen-home",
    "kitchen-fast-food",
  ]);
});

test("nested pages activate their parent navigation item", () => {
  const items = getVisibleStaffNavigationItems(user("ADMIN"), "admin");
  const nodes = getStaffNavigationNodesFromItems(items);
  const dashboard = items.find((item) => item.key === "dashboard");
  const invoices = items.find((item) => item.key === "supplier-invoices");

  expect(dashboard).toBeTruthy();
  if (!dashboard) throw new Error("Expected dashboard to be present");
  expect(isStaffNavActive("/admin", dashboard)).toBe(true);
  expect(isStaffNavActive("/admin/categories", dashboard)).toBe(false);
  expect(invoices).toBeTruthy();
  if (!invoices) throw new Error("Expected invoices to be present");
  expect(isStaffNavActive("/admin/supplier-invoices/invoice-123", invoices)).toBe(true);
  expect(getActiveStaffNavigationGroupKey("/admin/supplier-invoices/invoice-123", nodes)).toBe(
    "suppliers",
  );
  expect(getActiveStaffNavigationGroupKey("/admin/categories", nodes)).toBe("catalog");
  expect(getActiveStaffNavigationGroupKey("/admin", nodes)).toBe(null);
});

test("selecting a group closes the previous group and toggles itself", () => {
  expect(getNextOpenStaffNavigationGroupKey("catalog", "suppliers")).toBe("suppliers");
  expect(getNextOpenStaffNavigationGroupKey("suppliers", "suppliers")).toBe(null);
  expect(getNextOpenStaffNavigationGroupKey(null, "administration")).toBe("administration");
});
