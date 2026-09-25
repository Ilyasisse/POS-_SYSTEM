import assert from "node:assert/strict";
import test from "node:test";
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
      findUnique: async ({ where }) =>
        where.id === customer.id ? customer : null,
    },
  });
  assert.ok(profile);
  assert.equal(profile.role, "CUSTOMER");
  assert.equal(profile.station, null);
  assert.equal(hasPermission(profile, PERMISSIONS.CUSTOMER_ORDER), true);
  assert.equal(hasPermission(profile, PERMISSIONS.PAYMENT_TAKE), false);
  assert.equal(hasPermission(profile, PERMISSIONS.ADMIN_ACCESS), false);
});

test("inactive staff cannot fall back to an active customer profile", async () => {
  const staff = {
    ...customer,
    role: "CASHIER" as const,
    station: null,
    isActive: false,
  };
  const profile = await resolveAppProfile(staff.id, {
    staff: { findUnique: async () => staff },
    customer: {
      findUnique: async () => {
        assert.fail("must not fall back");
      },
    },
  });
  assert.equal(profile, staff);
  assert.equal(profile.isActive, false);
});

test("an unknown Auth ID does not resolve another profile", async () => {
  assert.equal(
    await resolveAppProfile("unknown", {
      staff: { findUnique: async () => null },
      customer: {
        findUnique: async ({ where }) =>
          where.id === customer.id ? customer : null,
      },
    }),
    null,
  );
});

test("customer deactivation is retained during profile resolution", async () => {
  const profile = await resolveAppProfile(customer.id, {
    staff: { findUnique: async () => null },
    customer: { findUnique: async () => ({ ...customer, isActive: false }) },
  });
  assert.equal(profile?.isActive, false);
});
