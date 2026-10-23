export function parseAllergenInfo(
  value: FormDataEntryValue | null,
): string | null {
  if (value !== null && typeof value !== "string") {
    throw new Error("Enter allergen information as text.");
  }
  const text = value?.trim() ?? "";
  if (text.length > 240) {
    throw new Error("Allergen information must be 240 characters or fewer.");
  }
  return text || null;
}
