/** Accept a hostname only, never a URL, path, wildcard, or forwarded-host list. */
export function normalizeHostname(input: string): string {
  const value = input.trim().toLowerCase().replace(/\.$/, "");
  if (!value || /[\s/@\\?#,]/.test(value)) throw new Error("Enter a hostname, for example cafe.example.com.");
  const host = value.replace(/:\d+$/, "").replace(/\.$/, "");
  if (host.length > 253 || !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error("Enter a valid hostname.");
  }
  return host;
}
