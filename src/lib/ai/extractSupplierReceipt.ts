import "server-only";

export type ExtractedSupplierReceiptItem = {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
  notes: string | null;
};

export type ExtractedSupplierReceipt = {
  supplierName: string | null;
  invoiceNumber: string | null;
  receiptDate: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  grandTotal: number | null;
  items: ExtractedSupplierReceiptItem[];
};

const receiptSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "supplierName",
    "invoiceNumber",
    "receiptDate",
    "subtotal",
    "tax",
    "discount",
    "grandTotal",
    "items",
  ],
  properties: {
    supplierName: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    receiptDate: { type: ["string", "null"] },
    subtotal: { type: ["number", "null"] },
    tax: { type: ["number", "null"] },
    discount: { type: ["number", "null"] },
    grandTotal: { type: ["number", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unitPrice", "totalPrice", "confidence", "notes"],
        properties: {
          name: { type: "string" },
          quantity: { type: ["number", "null"] },
          unitPrice: { type: ["number", "null"] },
          totalPrice: { type: ["number", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          notes: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

function outputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }

  throw new Error("OpenAI returned no receipt data.");
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validateParsedReceipt(value: unknown): ExtractedSupplierReceipt {
  if (!value || typeof value !== "object") throw new Error("Invalid receipt JSON.");
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.items)) throw new Error("Receipt items are missing.");

  return {
    supplierName: nullableString(row.supplierName),
    invoiceNumber: nullableString(row.invoiceNumber),
    receiptDate: nullableString(row.receiptDate),
    subtotal: nullableNumber(row.subtotal),
    tax: nullableNumber(row.tax),
    discount: nullableNumber(row.discount),
    grandTotal: nullableNumber(row.grandTotal),
    items: row.items.map((item, index) => {
      if (!item || typeof item !== "object") throw new Error(`Invalid line item ${index + 1}.`);
      const entry = item as Record<string, unknown>;
      const name = nullableString(entry.name);
      if (!name) throw new Error(`Line item ${index + 1} has no name.`);
      return {
        name,
        quantity: nullableNumber(entry.quantity),
        unitPrice: nullableNumber(entry.unitPrice),
        totalPrice: nullableNumber(entry.totalPrice),
        confidence: Math.max(0, Math.min(1, nullableNumber(entry.confidence) ?? 0)),
        notes: nullableString(entry.notes),
      };
    }),
  };
}

export async function extractSupplierReceipt(
  imageBytes: Uint8Array,
  contentType: string,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_RECEIPT_MODEL;
  if (!apiKey || !model) throw new Error("OpenAI receipt extraction is not configured.");

  const dataUrl = `data:${contentType};base64,${Buffer.from(imageBytes).toString("base64")}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Extract this supplier receipt. Copy values faithfully. Use null when not visible. Confidence is 0 to 1. This data will be reviewed by a manager before inventory changes.",
          },
          { type: "input_image", image_url: dataUrl, detail: "high" },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "supplier_receipt",
          strict: true,
          schema: receiptSchema,
        },
      },
    }),
  });

  const rawResponse = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      (rawResponse.error as { message?: string } | undefined)?.message ||
      `OpenAI request failed (${response.status}).`;
    throw new Error(message);
  }

  const parsed = validateParsedReceipt(JSON.parse(outputText(rawResponse)));
  return { rawResponse, parsed };
}
