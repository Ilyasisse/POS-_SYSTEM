import "server-only";

import OpenAI from "openai";
import {
  invoiceExtractionSchema,
  getOpenAIInvoiceConfig,
  validateExtractedInvoice,
} from "@/lib/openai/invoice-extraction";

export async function extractInvoice(imageBytes: Uint8Array, contentType: string) {
  const { apiKey, model } = getOpenAIInvoiceConfig();

  const client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
  const imageUrl = `data:${contentType};base64,${Buffer.from(imageBytes).toString("base64")}`;
  const response = await client.responses.create({
    model,
    instructions: [
      "Extract this supplier invoice faithfully for manager review.",
      "Transcribe every visible printed and handwritten word, number, label, note, and total in natural reading order.",
      "Preserve meaningful line breaks in transcription. Do not silently omit uncertain handwriting.",
      "Use null when a structured value is not visible. Do not invent missing values.",
      "Return line items in their visible order. Confidence is 0 to 1 and should reflect legibility.",
    ].join(" "),
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: "Extract the complete invoice transcription and structured invoice data from this image." },
        { type: "input_image", image_url: imageUrl, detail: "high" },
      ],
    }],
    text: {
      format: {
        type: "json_schema",
        name: "supplier_invoice",
        description: "A complete invoice transcription and structured fields for manager review.",
        strict: true,
        schema: invoiceExtractionSchema,
      },
    },
  });

  if (!response.output_text) throw new Error("OpenAI returned no invoice data.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(response.output_text);
  } catch (error) {
    throw new Error("OpenAI returned malformed invoice data.", { cause: error });
  }

  return {
    parsed: validateExtractedInvoice(decoded),
    audit: {
      responseId: response.id,
      model: response.model,
      status: response.status,
      usage: response.usage,
    },
  };
}
