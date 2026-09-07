export type CustomerFulfillmentType = "TAKEOUT" | "DELIVERY";

type FulfillmentInput = {
  fulfillmentType?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  notes?: string;
};

type FulfillmentResult =
  | {
      ok: true;
      value: {
        fulfillmentType: CustomerFulfillmentType;
        customerName: string;
        customerPhone: string;
        deliveryAddress: string | null;
        notes: string;
      };
    }
  | { ok: false; error: string };

export function validateCustomerFulfillment(
  input: FulfillmentInput,
): FulfillmentResult {
  if (
    input.fulfillmentType != null &&
    input.fulfillmentType !== "TAKEOUT" &&
    input.fulfillmentType !== "DELIVERY"
  ) {
    return { ok: false, error: "Select pickup or delivery." };
  }

  const fulfillmentType =
    input.fulfillmentType === "DELIVERY" ? "DELIVERY" : "TAKEOUT";
  const customerName = String(input.customerName ?? "").trim();
  const customerPhone = String(input.customerPhone ?? "").trim();
  const deliveryAddress = String(input.deliveryAddress ?? "").trim();
  const notes = String(input.notes ?? "").trim();

  if (customerName.length < 2 || customerName.length > 100) {
    return { ok: false, error: "Enter a customer name between 2 and 100 characters." };
  }

  if (customerPhone.length > 30) {
    return { ok: false, error: "Phone number must be 30 characters or fewer." };
  }

  if (notes.length > 500) {
    return { ok: false, error: "Order notes must be 500 characters or fewer." };
  }

  if (fulfillmentType === "DELIVERY") {
    if (customerPhone.length < 5) {
      return { ok: false, error: "A phone number is required for delivery." };
    }

    if (deliveryAddress.length < 5 || deliveryAddress.length > 500) {
      return {
        ok: false,
        error: "Enter a delivery address between 5 and 500 characters.",
      };
    }
  }

  return {
    ok: true,
    value: {
      fulfillmentType,
      customerName,
      customerPhone,
      deliveryAddress: fulfillmentType === "DELIVERY" ? deliveryAddress : null,
      notes,
    },
  };
}

export function buildCustomerOrderNote(input: {
  fulfillmentType: CustomerFulfillmentType;
  customerName: string;
  customerPhone: string;
  notes: string;
}) {
  return [
    `Customer: ${input.customerName}`,
    `Fulfillment: ${input.fulfillmentType === "DELIVERY" ? "Delivery" : "Pickup"}`,
    input.customerPhone ? `Phone: ${input.customerPhone}` : null,
    input.notes ? `Note: ${input.notes}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}
