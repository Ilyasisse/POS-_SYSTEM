export type ExtractedInvoiceItem = {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
  notes: string | null;
};

export type ExtractedInvoice = {
  transcription: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  total: number | null;
  items: ExtractedInvoiceItem[];
};

export function getOpenAIInvoiceConfig(
  env: { OPENAI_API_KEY?: string; OPENAI_INVOICE_MODEL?: string } = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_INVOICE_MODEL: process.env.OPENAI_INVOICE_MODEL,
  },
) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_INVOICE_MODEL?.trim();
  if (!apiKey || !model) {
    throw new Error("OpenAI invoice extraction is not configured. Set OPENAI_API_KEY and OPENAI_INVOICE_MODEL.");
  }
  return { apiKey, model };
}

export const invoiceExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["transcription", "supplierName", "invoiceNumber", "invoiceDate", "subtotal", "tax", "discount", "total", "items"],
  properties: {
    transcription: { type: "string" },
    supplierName: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    invoiceDate: { type: ["string", "null"] },
    subtotal: { type: ["number", "null"] },
    tax: { type: ["number", "null"] },
    discount: { type: ["number", "null"] },
    total: { type: ["number", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unitPrice", "totalPrice", "confidence", "notes"],
        properties: {
          description: { type: "string" },
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

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function validateExtractedInvoice(value: unknown): ExtractedInvoice {
  if (!value || typeof value !== "object") throw new Error("OpenAI returned invalid invoice data.");
  const row = value as Record<string, unknown>;
  const transcription = typeof row.transcription === "string" ? row.transcription.trim() : "";
  if (!transcription) throw new Error("OpenAI returned no invoice transcription.");
  if (!Array.isArray(row.items)) throw new Error("OpenAI returned invalid invoice items.");

  return {
    transcription,
    supplierName: nullableString(row.supplierName),
    invoiceNumber: nullableString(row.invoiceNumber),
    invoiceDate: nullableString(row.invoiceDate),
    subtotal: nullableNumber(row.subtotal),
    tax: nullableNumber(row.tax),
    discount: nullableNumber(row.discount),
    total: nullableNumber(row.total),
    items: row.items.map((item, index) => {
      if (!item || typeof item !== "object") throw new Error(`OpenAI returned an invalid invoice item ${index + 1}.`);
      const entry = item as Record<string, unknown>;
      const description = nullableString(entry.description);
      if (!description) throw new Error(`OpenAI invoice item ${index + 1} has no description.`);
      return {
        description,
        quantity: nullableNumber(entry.quantity),
        unitPrice: nullableNumber(entry.unitPrice),
        totalPrice: nullableNumber(entry.totalPrice),
        confidence: Math.max(0, Math.min(1, nullableNumber(entry.confidence) ?? 0)),
        notes: nullableString(entry.notes),
      };
    }),
  };
}
