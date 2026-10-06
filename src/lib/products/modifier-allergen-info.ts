export function parseModifierAllergenInfo(
  value: FormDataEntryValue | null,
): string | null {
  if (value !== null && typeof value !== "string") {
    throw new Error("Enter modifier allergen information as text.");
  }
  const text = value?.trim() ?? "";
  if (text.length > 240) {
    throw new Error(
      "Modifier allergen information must be 240 characters or fewer.",
    );
  }
  return text || null;
}
