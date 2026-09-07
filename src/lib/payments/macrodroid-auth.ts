import { timingSafeEqual } from "node:crypto";

export const MACRODROID_GATEWAY_ID = "macrodroid-898";

export function resolveMacrodroidSecret(
  env: NodeJS.ProcessEnv = process.env,
) {
  return (
    env.MACRODROID_PAYMENT_WEBHOOK_SECRET?.trim() ||
    env.PAYMENT_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

export function expectedMacrodroidSender(
  env: NodeJS.ProcessEnv = process.env,
) {
  return env.MACRODROID_PAYMENT_SMS_SENDER?.trim() || "898";
}

export function suppliedMacrodroidSecret(request: Request) {
  return (
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    request.headers.get("x-webhook-secret")?.trim() ||
    ""
  );
}

export function isMacrodroidAuthorized(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
) {
  const expected = resolveMacrodroidSecret(env);
  const supplied = suppliedMacrodroidSecret(request);
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isExpectedMacrodroidSender(
  sender: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  return (
    sender.trim().toUpperCase() ===
    expectedMacrodroidSender(env).toUpperCase()
  );
}
