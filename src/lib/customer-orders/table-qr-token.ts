import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const MINIMUM_SECRET_LENGTH = 32;

type TableQrPayload = {
  v: number;
  tableId: string;
  tokenVersion: number;
};

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

function isTableQrPayload(value: unknown): value is TableQrPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<TableQrPayload>;
  return (
    payload.v === TOKEN_VERSION &&
    typeof payload.tableId === "string" &&
    payload.tableId.length > 0 &&
    payload.tableId.length <= 128 &&
    Number.isSafeInteger(payload.tokenVersion) &&
    Number(payload.tokenVersion) > 0
  );
}

export function getTableQrSecret() {
  const secret = process.env.TABLE_QR_SECRET?.trim();

  if (!secret || secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("TABLE_QR_SECRET must contain at least 32 characters.");
  }

  return secret;
}

export function createTableQrToken(
  tableId: string,
  tokenVersion: number,
  secret = getTableQrSecret(),
) {
  const payload: TableQrPayload = {
    v: TOKEN_VERSION,
    tableId,
    tokenVersion,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload, secret).toString("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyTableQrToken(
  token: string,
  secret = getTableQrSecret(),
): Omit<TableQrPayload, "v"> | null {
  const [encodedPayload, encodedSignature, extraPart] = token.split(".");
  if (!encodedPayload || !encodedSignature || extraPart) return null;

  try {
    const providedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = signPayload(encodedPayload, secret);

    if (
      providedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(providedSignature, expectedSignature)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;

    if (!isTableQrPayload(payload)) return null;

    return {
      tableId: payload.tableId,
      tokenVersion: payload.tokenVersion,
    };
  } catch {
    return null;
  }
}
