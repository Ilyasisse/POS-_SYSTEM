import { expect, test } from "@jest/globals";

import { resolveAppProfile } from "../../src/lib/auth/profile-resolution";
import { hasPermission, PERMISSIONS } from "../../src/lib/auth/permissions";

const customer = {
  id: "auth-customer",
  email: "customer@example.com",
  fullName: "Customer",
  phoneNumber: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

test("customer profile receives only customer permissions and no station", async () => {
  const profile = await resolveAppProfile(customer.id, {
    staff: { findUnique: async () => null },
    customer: {
      findUnique: async ({ where }) => (where.id === customer.id ? customer : null),
    },
  });
  expect(profile).toBeTruthy();
  if (!profile) throw new Error("Expected profile to be present");
  expect(profile.role).toBe("CUSTOMER");
  expect(profile.station).toBe(null);
  expect(hasPermission(profile, PERMISSIONS.CUSTOMER_ORDER)).toBe(true);
  expect(hasPermission(profile, PERMISSIONS.PAYMENT_TAKE)).toBe(false);
  expect(hasPermission(profile, PERMISSIONS.ADMIN_ACCESS)).toBe(false);
});

test("inactive staff cannot fall back to an active customer profile", async () => {
  const staff = {
    ...customer,
    role: "CASHIER" as const,
    availability: "OFFLINE" as const,
    lastSeenAt: null,
    station: null,
    isActive: false,
  };
  const profile = await resolveAppProfile(staff.id, {
    staff: { findUnique: async () => staff },
    customer: {
      findUnique: async () => {
        throw new Error("must not fall back");
      },
    },
  });
  expect(profile).toBe(staff);
  if (!profile) throw new Error("Expected staff profile");
  expect(profile.isActive).toBe(false);
});

test("an unknown Auth ID does not resolve another profile", async () => {
  expect(
    await resolveAppProfile("unknown", {
      staff: { findUnique: async () => null },
      customer: {
        findUnique: async ({ where }) => (where.id === customer.id ? customer : null),
      },
    }),
  ).toBe(null);
});

test("customer deactivation is retained during profile resolution", async () => {
  const profile = await resolveAppProfile(customer.id, {
    staff: { findUnique: async () => null },
    customer: { findUnique: async () => ({ ...customer, isActive: false }) },
  });
  expect(profile?.isActive).toBe(false);
});
