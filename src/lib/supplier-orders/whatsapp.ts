import twilio from "twilio";

export type WhatsAppConfig = {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  authToken: string;
  from: string;
  appBaseUrl: string;
  invitationContentSid: string;
  reminderContentSid: string;
  supplierOrderContentSid: string;
};

type TwilioMessage = { sid: string };

export type TwilioMessageClient = {
  messages: {
    create(input: {
      contentSid: string;
      contentVariables: string;
      from: string;
      to: string;
      statusCallback: string;
    }): Promise<TwilioMessage>;
  };
};

export type TwilioStatusUpdate = {
  messageId: string;
  status: "accepted" | "delivered" | "read" | "failed";
  error?: string;
};

export type StoredWhatsAppStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DELIVERED"
  | "READ"
  | "FAILED";

function required(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is not configured.`);
  return value;
}

function whatsappAddress(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

function baseUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("APP_BASE_URL must be an absolute URL.");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("APP_BASE_URL must contain only the application origin.");
  }
  return parsed.origin;
}

export function isWhatsAppEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.TWILIO_WHATSAPP_ENABLED?.trim().toLowerCase() === "true";
}

export function readWhatsAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppConfig {
  return {
    accountSid: required(env, "TWILIO_ACCOUNT_SID"),
    apiKeySid: required(env, "TWILIO_API_KEY_SID"),
    apiKeySecret: required(env, "TWILIO_API_KEY_SECRET"),
    authToken: required(env, "TWILIO_AUTH_TOKEN"),
    from: whatsappAddress(required(env, "TWILIO_WHATSAPP_FROM")),
    appBaseUrl: baseUrl(required(env, "APP_BASE_URL")),
    invitationContentSid: required(
      env,
      "TWILIO_EMPLOYEE_INVITATION_CONTENT_SID",
    ),
    reminderContentSid: required(
      env,
      "TWILIO_EMPLOYEE_REMINDER_CONTENT_SID",
    ),
    supplierOrderContentSid: required(
      env,
      "TWILIO_SUPPLIER_ORDER_CONTENT_SID",
    ),
  };
}

export function createWhatsAppClient(config: WhatsAppConfig): TwilioMessageClient {
  return twilio(config.apiKeySid, config.apiKeySecret, {
    accountSid: config.accountSid,
  }) as TwilioMessageClient;
}

async function sendTemplate(
  config: WhatsAppConfig,
  to: string,
  contentSid: string,
  variables: Record<string, string>,
  client: TwilioMessageClient,
) {
  const message = await client.messages.create({
    contentSid,
    contentVariables: JSON.stringify(variables),
    from: config.from,
    to: whatsappAddress(to),
    statusCallback: `${config.appBaseUrl}/api/webhooks/whatsapp`,
  });
  if (!message.sid) throw new Error("Twilio accepted no message SID.");
  return message.sid;
}

export async function sendEmployeeOrderLink(
  input: {
    config: WhatsAppConfig;
    to: string;
    employeeName: string;
    supplierName: string;
    deadline: string;
    token: string;
    reminder: boolean;
  },
  client = createWhatsAppClient(input.config),
) {
  return sendTemplate(
    input.config,
    input.to,
    input.reminder
      ? input.config.reminderContentSid
      : input.config.invitationContentSid,
    {
      "1": input.employeeName,
      "2": input.supplierName,
      "3": input.deadline,
      "4": input.token,
    },
    client,
  );
}

export async function sendSupplierPurchaseOrder(
  input: {
    config: WhatsAppConfig;
    to: string;
    mediaPath: string;
    orderNumber: number;
    deliveryDate: string;
    total: string;
  },
  client = createWhatsAppClient(input.config),
) {
  return sendTemplate(
    input.config,
    input.to,
    input.config.supplierOrderContentSid,
    {
      "1": input.mediaPath,
      "2": String(input.orderNumber),
      "3": input.deliveryDate,
      "4": input.total,
    },
    client,
  );
}

export function verifyTwilioSignature(input: {
  authToken: string;
  signatureHeader: string | null;
  url: string;
  params: Record<string, string>;
}) {
  if (!input.signatureHeader) return false;
  return twilio.validateRequest(
    input.authToken,
    input.signatureHeader,
    input.url,
    input.params,
  );
}

export function extractTwilioStatusUpdate(
  params: Record<string, string>,
): TwilioStatusUpdate | null {
  const messageId = params.MessageSid || params.SmsSid;
  if (!messageId) return null;
  if (params.EventType?.toUpperCase() === "READ") {
    return { messageId, status: "read" };
  }

  const rawStatus = (params.MessageStatus || params.SmsStatus || "").toLowerCase();
  const error =
    params.ChannelStatusMessage ||
    params.ErrorMessage ||
    (params.ErrorCode ? `Twilio error ${params.ErrorCode}` : undefined);
  if (["failed", "undelivered", "canceled"].includes(rawStatus)) {
    return { messageId, status: "failed", error };
  }
  if (rawStatus === "delivered") return { messageId, status: "delivered" };
  if (["accepted", "queued", "sending", "sent"].includes(rawStatus)) {
    return { messageId, status: "accepted" };
  }
  return null;
}

export function shouldApplyWhatsAppStatus(
  current: StoredWhatsAppStatus,
  next: StoredWhatsAppStatus,
) {
  if (current === "FAILED") return false;
  if (next === "FAILED") return !["DELIVERED", "READ"].includes(current);
  const rank: Record<Exclude<StoredWhatsAppStatus, "FAILED">, number> = {
    PENDING: 0,
    ACCEPTED: 1,
    DELIVERED: 2,
    READ: 3,
  };
  return rank[next as Exclude<StoredWhatsAppStatus, "FAILED">] > rank[current];
}
