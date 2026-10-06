export const MAX_ORDER_ITEM_NOTE_LENGTH = 500;

export class OrderItemNoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderItemNoteValidationError";
  }
}

export function normalizeOrderItemNote(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new OrderItemNoteValidationError("Item instructions must be text.");
  }

  const note = value.trim();
  if (!note) return null;
  if (note.length > MAX_ORDER_ITEM_NOTE_LENGTH) {
    throw new OrderItemNoteValidationError(
      `Item instructions cannot exceed ${MAX_ORDER_ITEM_NOTE_LENGTH} characters.`,
    );
  }

  return note;
}
