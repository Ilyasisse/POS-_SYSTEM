const MAX_DATABASE_QUANTITY = 2_147_483_647;

export class OrderInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderInputError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_DATABASE_QUANTITY
  );
}

export async function readOrderRequest<T>(
  request: Pick<Request, "json">,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new OrderInputError("Invalid order JSON.");
  }
  if (!isRecord(body))
    throw new OrderInputError("An order object is required.");
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new OrderInputError("No items provided.");
  }
  if (body.notes !== undefined && typeof body.notes !== "string") {
    throw new OrderInputError("Order notes must be text.");
  }
  for (const item of body.items) {
    if (!isRecord(item) || !isId(item.productId)) {
      throw new OrderInputError("Every order item needs a product.");
    }
    if (!isQuantity(item.qty)) {
      throw new OrderInputError(
        "Item quantity must be a positive whole number.",
      );
    }
    if (
      item.assignedBaristaId !== undefined &&
      item.assignedBaristaId !== null &&
      !isId(item.assignedBaristaId)
    ) {
      throw new OrderInputError("Assigned barista is invalid.");
    }
    if (item.modifiers === undefined) continue;
    if (!Array.isArray(item.modifiers)) {
      throw new OrderInputError("Item modifiers must be a list.");
    }
    for (const modifier of item.modifiers) {
      if (!isRecord(modifier) || !isId(modifier.modifierId)) {
        throw new OrderInputError("Every selected modifier needs an option.");
      }
      if (modifier.qty !== undefined && !isQuantity(modifier.qty)) {
        throw new OrderInputError(
          "Modifier quantity must be a positive whole number.",
        );
      }
      for (const field of ["groupName", "modifierName"]) {
        if (
          modifier[field] !== undefined &&
          typeof modifier[field] !== "string"
        ) {
          throw new OrderInputError("Modifier names must be text.");
        }
      }
      if (
        modifier.price !== undefined &&
        (typeof modifier.price !== "number" ||
          !Number.isFinite(modifier.price) ||
          modifier.price < 0)
      ) {
        throw new OrderInputError(
          "Modifier price must be a valid nonnegative amount.",
        );
      }
    }
  }
  return body as T;
}
