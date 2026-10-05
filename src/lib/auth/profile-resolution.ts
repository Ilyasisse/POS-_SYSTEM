import type { Customer, Staff } from "@prisma/client";

type ProfileLookup<T> = {
  findUnique(args: { where: { id: string } }): Promise<T | null>;
};

/** Staff membership takes precedence, including when it is deactivated. */
export async function resolveAppProfile(
  id: string,
  profiles: { staff: ProfileLookup<Staff>; customer: ProfileLookup<Customer> },
) {
  const staff = await profiles.staff.findUnique({ where: { id } });
  if (staff) return staff;
  const customer = await profiles.customer.findUnique({ where: { id } });
  return customer
    ? { ...customer, role: "CUSTOMER" as const, station: null }
    : null;
}
