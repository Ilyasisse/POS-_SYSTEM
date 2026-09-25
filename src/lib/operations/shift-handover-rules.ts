export class HandoverValidationError extends Error {}

export function requiredHandoverText(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "string")
    throw new HandoverValidationError(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    throw new HandoverValidationError(
      `${label} must be ${minimum}–${maximum} characters.`,
    );
  }
  return trimmed;
}

export function parseHandoverDraft(input: {
  title: unknown;
  details: unknown;
  requestToken: unknown;
}) {
  const requestToken = String(input.requestToken ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestToken,
    )
  ) {
    throw new HandoverValidationError("Refresh the page and retry this note.");
  }
  return {
    title: requiredHandoverText(input.title, "Title", 5, 120),
    details: requiredHandoverText(input.details, "Details", 10, 1000),
    requestToken,
  };
}
