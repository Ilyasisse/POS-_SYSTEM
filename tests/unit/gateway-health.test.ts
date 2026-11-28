import assert from "node:assert/strict";
import test from "node:test";
import { getGatewayHealth } from "../../src/lib/payments/gateway-health";

const now = new Date("2026-09-13T03:00:00.000Z");

test("distinguishes configuration and first connection", () => {
  assert.equal(getGatewayHealth({ configured: false, lastHeartbeatAt: null, now }).state, "UNCONFIGURED");
  assert.equal(getGatewayHealth({ configured: true, lastHeartbeatAt: null, now }).state, "NEVER_CONNECTED");
});

test("classifies current, delayed, and offline heartbeats", () => {
  const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1000);
  assert.equal(getGatewayHealth({ configured: true, lastHeartbeatAt: secondsAgo(60), now }).state, "ONLINE");
  assert.equal(getGatewayHealth({ configured: true, lastHeartbeatAt: secondsAgo(300), now }).state, "DEGRADED");
  assert.equal(getGatewayHealth({ configured: true, lastHeartbeatAt: secondsAgo(900), now }).state, "OFFLINE");
});

test("clamps future heartbeat age to zero", () => {
  assert.deepEqual(
    getGatewayHealth({ configured: true, lastHeartbeatAt: new Date(now.getTime() + 60_000), now }),
    { state: "ONLINE", ageSeconds: 0 },
  );
});
