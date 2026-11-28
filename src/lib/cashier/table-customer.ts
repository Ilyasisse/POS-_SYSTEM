export type CustomerLookup =
  | { kind: "none" }
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string }
  | { kind: "invalid" };

export function parseCustomerLookup(raw: unknown): CustomerLookup {
  if (raw == null || raw === "") return { kind: "none" };
  if (typeof raw !== "string") return { kind: "invalid" };
  const value = raw.trim();
  if (!value) return { kind: "none" };
  if (value.length > 254) return { kind: "invalid" };
  if (value.includes("@")) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
      ? { kind: "email", value: value.toLowerCase() }
      : { kind: "invalid" };
  }
  return /^\+?[0-9]{6,20}$/.test(value)
    ? { kind: "phone", value }
    : { kind: "invalid" };
}

/**
 * A later kitchen round cannot silently change whom an open table bill
 * belongs to. The existing customer is inherited when no new ID is provided.
 */
export function resolveTableCustomer(
  hasOpenOrder: boolean,
  existingCustomerId: string | null,
  requestedCustomerId: string | null,
):
  | { customerId: string | null; error?: never }
  | { error: string; customerId?: never } {
  if (!hasOpenOrder) return { customerId: requestedCustomerId };
  if (requestedCustomerId && requestedCustomerId !== existingCustomerId)
    return {
      error:
        "This table already has an open check. Set the customer on its first order, or close that check before linking another customer.",
    };
  return { customerId: existingCustomerId };
}
