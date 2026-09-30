/** Limit the OAuth return destination to the customer order page. */
export function customerReturnPath(value: string | null): "/customer" | null {
  return value === "/customer" ? "/customer" : null;
}
