export type TableMetadata = {
  name: string;
  capacity: number;
  section: string;
  isActive: boolean;
};

export function parseTableMetadata(input: {
  name?: unknown;
  capacity?: unknown;
  section?: unknown;
  isActive?: unknown;
}): TableMetadata {
  const name = String(input.name ?? "").trim();
  const capacity = Number(input.capacity);
  const section = String(input.section ?? "").trim();

  if (!name || name.length > 80) {
    throw new Error("Table name must be between 1 and 80 characters.");
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
    throw new Error("Capacity must be a whole number between 1 and 50.");
  }
  if (!section || section.length > 80) {
    throw new Error("Section must be between 1 and 80 characters.");
  }

  return {
    name,
    capacity,
    section,
    isActive: input.isActive === true || input.isActive === "active",
  };
}
