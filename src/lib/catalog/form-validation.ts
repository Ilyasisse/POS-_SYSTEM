const MAX_DATABASE_INT = 2_147_483_647;

export function validateCatalogPrice(price: number) {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a finite, non-negative number.");
  }
}

export function validateCatalogInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_DATABASE_INT) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
}

export function modifierGroupFields(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const minSelect = Number(formData.get("minSelect") || 0);
  const maxSelect = Number(formData.get("maxSelect") || 1);
  if (!name) throw new Error("Modifier group name is required.");
  validateCatalogInteger(minSelect, "Minimum selections");
  validateCatalogInteger(maxSelect, "Maximum selections");
  if (maxSelect < minSelect) {
    throw new Error(
      "Maximum selections cannot be less than minimum selections.",
    );
  }
  return {
    name,
    minSelect,
    maxSelect,
    isActive: formData.get("isActive") === "on",
  };
}

export function modifierGroupId(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Modifier group id is required.");
  return id;
}
