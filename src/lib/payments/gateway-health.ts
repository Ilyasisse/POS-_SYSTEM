export const GATEWAY_ONLINE_AFTER_MS = 150_000;
export const GATEWAY_DEGRADED_AFTER_MS = 600_000;

export type GatewayHealthState =
  | "UNCONFIGURED"
  | "NEVER_CONNECTED"
  | "ONLINE"
  | "DEGRADED"
  | "OFFLINE";

export function getGatewayHealth(input: {
  configured: boolean;
  lastHeartbeatAt: Date | null;
  now?: Date;
}) {
  if (!input.configured) {
    return { state: "UNCONFIGURED" as const, ageSeconds: null };
  }
  if (!input.lastHeartbeatAt) {
    return { state: "NEVER_CONNECTED" as const, ageSeconds: null };
  }
  const ageMs = Math.max(
    0,
    (input.now ?? new Date()).getTime() - input.lastHeartbeatAt.getTime(),
  );
  const state: GatewayHealthState =
    ageMs <= GATEWAY_ONLINE_AFTER_MS
      ? "ONLINE"
      : ageMs <= GATEWAY_DEGRADED_AFTER_MS
        ? "DEGRADED"
        : "OFFLINE";
  return { state, ageSeconds: Math.floor(ageMs / 1000) };
}
