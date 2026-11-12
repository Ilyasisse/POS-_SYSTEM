export type CustomerReturnPath = "/customer" | "/customer/orders";

/** Allow only known customer destinations after Google sign-in. */
export function parseCustomerReturnPath(value: string | null): CustomerReturnPath | null {
  return value === "/customer" || value === "/customer/orders" ? value : null;
}
