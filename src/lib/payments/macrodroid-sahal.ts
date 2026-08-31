import { createHash } from "node:crypto";

export type ParsedSahalMessage =
  | {
      ok: true;
      providerLabel: "SAHAL";
      method: "GOLIS";
      providerReference: string;
      direction: "INCOMING" | "OUTGOING";
      status: "AVAILABLE" | "OUTGOING";
      amount: string;
      currency: "USD";
      counterpartyLabel: string;
      counterpartyIdentifiers: string[];
      transactionAt: Date;
      providerBalance: string;
    }
  | {
      ok: false;
      direction: "UNKNOWN";
      status: "NEEDS_REVIEW";
      error: string;
    };

const MONEY = "([0-9][0-9,]*(?:\\.[0-9]{1,2})?)";
const MESSAGE_TAIL = new RegExp(
  `^(.*?)\\s+Tar\\s+(\\d{2}\\/\\d{2}\\/\\d{2})\\s+(\\d{2}:\\d{2}:\\d{2})\\s*,?\\s*Haraagaagu\\s+waa\\s+\\$\\s*${MONEY}\\s*\\.?$`,
  "i",
);
const INCOMING = new RegExp(
  `^Waxaad\\s+\\$\\s*${MONEY}\\s+ka\\s+heshay\\s+(.+)$`,
  "i",
);
const OUTGOING = new RegExp(
  `^\\$\\s*${MONEY}\\s+ayaad\\s+u\\s+dirtay\\s+(.+)$`,
  "i",
);

function money(value: string) {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : null;
}

function nairobiDate(dateValue: string, timeValue: string) {
  const [day, month, year] = dateValue.split("/").map(Number);
  const [hour, minute, second] = timeValue.split(":").map(Number);
  const date = new Date(
    `20${String(year).padStart(2, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+03:00`,
  );
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return (
    parts.year === String(year).padStart(2, "0") &&
    parts.month === String(month).padStart(2, "0") &&
    parts.day === String(day).padStart(2, "0") &&
    parts.hour === String(hour).padStart(2, "0") &&
    parts.minute === String(minute).padStart(2, "0") &&
    parts.second === String(second).padStart(2, "0")
  )
    ? date
    : null;
}

export function normalizeSmsMessage(rawMessage: string) {
  return rawMessage.replace(/\s+/g, " ").trim();
}

export function fingerprintSms(sender: string, rawMessage: string) {
  return createHash("sha256")
    .update(`${sender.trim().toUpperCase()}\n${normalizeSmsMessage(rawMessage)}`)
    .digest("hex");
}

export function parseSahalMessage(rawMessage: string): ParsedSahalMessage {
  const message = normalizeSmsMessage(rawMessage);
  const header = message.match(/^\[SAHAL\]\s*Tix:\s*(\d+)\s*,\s*(.+)$/i);
  if (!header) {
    return {
      ok: false,
      direction: "UNKNOWN",
      status: "NEEDS_REVIEW",
      error: "The SMS does not match the SAHAL transaction header.",
    };
  }

  const tail = header[2]?.match(MESSAGE_TAIL);
  if (!tail) {
    return {
      ok: false,
      direction: "UNKNOWN",
      status: "NEEDS_REVIEW",
      error: "The transaction date, time, or provider balance could not be parsed.",
    };
  }

  const details = tail[1]?.trim() ?? "";
  const transactionAt = nairobiDate(tail[2] ?? "", tail[3] ?? "");
  const providerBalance = money(tail[4] ?? "");
  const incoming = details.match(INCOMING);
  const outgoing = incoming ? null : details.match(OUTGOING);
  const direction = incoming ? "INCOMING" : outgoing ? "OUTGOING" : null;
  const amount = money((incoming ?? outgoing)?.[1] ?? "");
  const counterpartyLabel = (incoming ?? outgoing)?.[2]?.trim() ?? "";

  if (
    !direction ||
    !amount ||
    !counterpartyLabel ||
    !transactionAt ||
    providerBalance === null
  ) {
    return {
      ok: false,
      direction: "UNKNOWN",
      status: "NEEDS_REVIEW",
      error: "The SAHAL transaction details could not be fully parsed.",
    };
  }

  return {
    ok: true,
    providerLabel: "SAHAL",
    method: "GOLIS",
    providerReference: header[1] ?? "",
    direction,
    status: direction === "INCOMING" ? "AVAILABLE" : "OUTGOING",
    amount,
    currency: "USD",
    counterpartyLabel,
    counterpartyIdentifiers: [
      ...new Set(counterpartyLabel.match(/\d{5,}/g) ?? []),
    ],
    transactionAt,
    providerBalance,
  };
}
