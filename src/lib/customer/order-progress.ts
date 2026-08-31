import type {
  KitchenPickupStatus,
  KitchenStationTicketStatus,
  OrderStatus,
} from "@prisma/client";

type ProgressInput = {
  orderStatus: OrderStatus;
  pickupStatus?: KitchenPickupStatus | null;
  stationStatuses?: readonly KitchenStationTicketStatus[];
};

export function getCustomerOrderProgress(input: ProgressInput) {
  if (input.orderStatus === "CANCELLED") {
    return {
      label: "Cancelled",
      tone: "error" as const,
      description: "This order was cancelled. Ask cafe staff if you need help.",
    };
  }
  if (input.pickupStatus === "DELIVERED") {
    return {
      label: "Delivered",
      tone: "complete" as const,
      description: "Your order has been handed over.",
    };
  }
  if (input.pickupStatus === "CLAIMED") {
    return {
      label: "On the way",
      tone: "ready" as const,
      description: "A waiter has collected your completed order.",
    };
  }
  if (input.pickupStatus === "READY") {
    return {
      label: "Ready",
      tone: "ready" as const,
      description: "Your order is ready for pickup or delivery to your table.",
    };
  }

  const stationStatuses = input.stationStatuses ?? [];
  if (
    stationStatuses.length > 0 &&
    stationStatuses.every((status) => status === "DONE")
  ) {
    return {
      label: "Finishing",
      tone: "active" as const,
      description: "Every kitchen station is done. Staff are preparing handoff.",
    };
  }
  if (stationStatuses.some((status) => status === "IN_PROGRESS")) {
    return {
      label: "Preparing",
      tone: "active" as const,
      description: "The kitchen is preparing your order now.",
    };
  }
  if (input.orderStatus === "PAID") {
    return {
      label: "Paid",
      tone: "complete" as const,
      description: "Payment is complete.",
    };
  }
  return {
    label: "Queued",
    tone: "queued" as const,
    description: "The cafe received your order and queued it for preparation.",
  };
}
