import { createHmac, timingSafeEqual } from "node:crypto";

export type WhatsAppConfig = {
  apiVersion: string;
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  appSecret: string;
  webhookVerifyToken: string;
  appBaseUrl: string;
  templateLanguage: string;
  invitationTemplate: string;
  reminderTemplate: string;
  supplierOrderTemplate: string;
};

type MetaMessageResponse = {
  messages?: { id?: string }[];
  error?: { message?: string; code?: number };
};

function required(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is not configured.`);
  return value;
}

export function readWhatsAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppConfig {
  const apiVersion = required(env, "WHATSAPP_GRAPH_API_VERSION");
  return {
    apiVersion: apiVersion.startsWith("v") ? apiVersion : `v${apiVersion}`,
    accessToken: required(env, "WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: required(env, "WHATSAPP_PHONE_NUMBER_ID"),
    businessAccountId: required(env, "WHATSAPP_BUSINESS_ACCOUNT_ID"),
    appSecret: required(env, "WHATSAPP_APP_SECRET"),
    webhookVerifyToken: required(env, "WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    appBaseUrl: required(env, "APP_BASE_URL").replace(/\/$/, ""),
    templateLanguage: required(env, "WHATSAPP_TEMPLATE_LANGUAGE"),
    invitationTemplate: required(env, "WHATSAPP_EMPLOYEE_INVITATION_TEMPLATE"),
    reminderTemplate: required(env, "WHATSAPP_EMPLOYEE_REMINDER_TEMPLATE"),
    supplierOrderTemplate: required(env, "WHATSAPP_SUPPLIER_ORDER_TEMPLATE"),
  };
}

function graphUrl(config: WhatsAppConfig, path: string) {
  return `https://graph.facebook.com/${config.apiVersion}/${path}`;
}

async function readMetaResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as MetaMessageResponse;
  if (!response.ok) {
    throw new Error(
      payload.error?.message ?? `WhatsApp API request failed (${response.status}).`,
    );
  }
  return payload;
}

async function sendTemplate(
  config: WhatsAppConfig,
  to: string,
  name: string,
  components: unknown[],
) {
  const response = await fetch(
    graphUrl(config, `${config.phoneNumberId}/messages`),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name,
          language: { code: config.templateLanguage },
          components,
        },
      }),
    },
  );
  const payload = await readMetaResponse(response);
  const messageId = payload.messages?.[0]?.id;
  if (!messageId) throw new Error("WhatsApp accepted no message identifier.");
  return messageId;
}

const textParameter = (text: string) => ({ type: "text", text });

export async function sendEmployeeOrderLink(input: {
  config: WhatsAppConfig;
  to: string;
  employeeName: string;
  supplierName: string;
  deadline: string;
  token: string;
  reminder: boolean;
}) {
  return sendTemplate(
    input.config,
    input.to,
    input.reminder
      ? input.config.reminderTemplate
      : input.config.invitationTemplate,
    [
      {
        type: "body",
        parameters: [
          textParameter(input.employeeName),
          textParameter(input.supplierName),
          textParameter(input.deadline),
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [textParameter(input.token)],
      },
    ],
  );
}

export async function uploadPurchaseOrderPdf(
  config: WhatsAppConfig,
  pdf: Uint8Array,
  filename: string,
) {
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", "application/pdf");
  form.set(
    "file",
    new Blob([new Uint8Array(pdf)], { type: "application/pdf" }),
    filename,
  );
  const response = await fetch(
    graphUrl(config, `${config.phoneNumberId}/media`),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}` },
      body: form,
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.id) {
    throw new Error(
      payload.error?.message ?? `WhatsApp media upload failed (${response.status}).`,
    );
  }
  return payload.id;
}

export async function sendSupplierPurchaseOrder(input: {
  config: WhatsAppConfig;
  to: string;
  mediaId: string;
  filename: string;
  orderNumber: number;
  deliveryDate: string;
  total: string;
}) {
  return sendTemplate(
    input.config,
    input.to,
    input.config.supplierOrderTemplate,
    [
      {
        type: "header",
        parameters: [
          {
            type: "document",
            document: { id: input.mediaId, filename: input.filename },
          },
        ],
      },
      {
        type: "body",
        parameters: [
          textParameter(String(input.orderNumber)),
          textParameter(input.deliveryDate),
          textParameter(input.total),
        ],
      },
    ],
  );
}

export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = Buffer.from(signatureHeader.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export type WhatsAppStatusUpdate = {
  messageId: string;
  status: "accepted" | "sent" | "delivered" | "read" | "failed";
  error?: string;
};

export function extractWhatsAppStatusUpdates(payload: unknown) {
  const updates: WhatsAppStatusUpdate[] = [];
  if (!payload || typeof payload !== "object") return updates;
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return updates;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown } }).value
        ?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const raw of statuses) {
        const status = raw as {
          id?: unknown;
          status?: unknown;
          errors?: { title?: string; message?: string }[];
        };
        if (
          typeof status.id === "string" &&
          ["accepted", "sent", "delivered", "read", "failed"].includes(
            String(status.status),
          )
        ) {
          updates.push({
            messageId: status.id,
            status: status.status as WhatsAppStatusUpdate["status"],
            error: status.errors?.[0]?.message ?? status.errors?.[0]?.title,
          });
        }
      }
    }
  }
  return updates;
}
