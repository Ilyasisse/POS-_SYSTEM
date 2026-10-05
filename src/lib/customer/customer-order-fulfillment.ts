export type CustomerFulfillmentType = "DINE_IN" | "TAKEOUT" | "DELIVERY";

export type CustomerFulfillmentField =
  | "orderType"
  | "customerName"
  | "tableId"
  | "deliveryPhone"
  | "deliveryAddress";

type FulfillmentInput = {
  orderType?: string | null;
  customerName?: string | null;
  tableId?: string | null;
  deliveryPhone?: string | null;
  deliveryAddress?: string | null;
};

type FulfillmentResult =
  | {
      ok: true;
      value: {
        orderType: CustomerFulfillmentType;
        customerName: string;
        tableId: string | null;
        deliveryPhone: string | null;
        deliveryAddress: string | null;
      };
    }
  | { ok: false; error: string; field: CustomerFulfillmentField };

export function validateCustomerFulfillment(
  input: FulfillmentInput,
): FulfillmentResult {
  const orderType = input.orderType ?? "TAKEOUT";
  if (orderType !== "DINE_IN" && orderType !== "TAKEOUT" && orderType !== "DELIVERY") {
    return { ok: false, error: "Choose dine-in, to-go, or delivery.", field: "orderType" };
  }
  const customerName = String(input.customerName ?? "").trim();
  const tableId = orderType === "DINE_IN" ? String(input.tableId ?? "").trim() : null;
  const deliveryPhone = String(input.deliveryPhone ?? "").trim();
  const deliveryAddress = String(input.deliveryAddress ?? "").trim();

  if (customerName.length < 1 || customerName.length > 100) {
    return { ok: false, error: "Enter a customer name between 1 and 100 characters.", field: "customerName" };
  }

  if (orderType === "DINE_IN" && !tableId) {
    return { ok: false, error: "Select your table.", field: "tableId" };
  }

  if (orderType === "DELIVERY") {
    if (
      typeof input.deliveryPhone !== "string" ||
      !/^\+?[\d\s()-]+$/.test(deliveryPhone) ||
      deliveryPhone.replace(/\D/g, "").length < 5 ||
      deliveryPhone.length > 30
    ) {
      return { ok: false, error: "Enter a valid delivery phone number with at least 5 digits and no more than 30 characters.", field: "deliveryPhone" };
    }

    if (typeof input.deliveryAddress !== "string" || deliveryAddress.length < 5 || deliveryAddress.length > 500) {
      return {
        ok: false,
        error: "Enter a delivery address between 5 and 500 characters.",
        field: "deliveryAddress",
      };
    }
  }

  return {
    ok: true,
    value: {
      orderType,
      customerName,
      tableId,
      deliveryPhone: orderType === "DELIVERY" ? deliveryPhone : null,
      deliveryAddress: orderType === "DELIVERY" ? deliveryAddress : null,
    },
  };
}

export function customerFulfillmentDestination(input: {
  orderType: CustomerFulfillmentType;
  tableName?: string | null;
  deliveryAddress?: string | null;
}) {
  if (input.orderType === "DELIVERY") {
    return input.deliveryAddress ? `Delivery · ${input.deliveryAddress}` : "Delivery";
  }
  return input.orderType === "DINE_IN" ? input.tableName ?? "Dine in" : "To go";
}

export function buildCustomerOrderNote(input: {
  orderType: CustomerFulfillmentType;
  customerName: string;
  payerPhone: string;
  deliveryPhone?: string | null;
  deliveryAddress?: string | null;
}) {
  return [
    `Customer: ${input.customerName}`,
    `Phone: ${input.payerPhone}`,
    input.orderType === "DELIVERY" ? "Delivery" : input.orderType === "DINE_IN" ? "Dine in" : "To go",
    input.orderType === "DELIVERY" && input.deliveryPhone ? `Delivery phone: ${input.deliveryPhone}` : null,
    input.orderType === "DELIVERY" && input.deliveryAddress ? `Address: ${input.deliveryAddress}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}
