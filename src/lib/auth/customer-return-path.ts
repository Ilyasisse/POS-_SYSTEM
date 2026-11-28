export type CustomerReturnPath = "/customer" | "/customer/orders";

/** Allow only known customer destinations after Google sign-in. */
export function customerReturnPath(value: string | null): CustomerReturnPath | null {
  return value === "/customer" || value === "/customer/orders" ? value : null;
}
