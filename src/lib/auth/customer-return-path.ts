/** Allow only customer ordering routes, including one signed table-code segment. */
export function customerReturnPath(
  value: string | null,
): "/customer" | `/table/${string}` | null {
  if (value === "/customer") return value;
  if (
    value &&
    value.length <= 519 &&
    /^\/table\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  ) {
    return value as `/table/${string}`;
  }
  return null;
}
