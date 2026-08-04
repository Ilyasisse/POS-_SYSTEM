import { createHash } from "node:crypto";

export function dailyCashFingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify({ version: "daily-cash-v1", value }))
    .digest("hex");
}
