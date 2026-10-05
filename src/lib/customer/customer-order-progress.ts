export type CustomerOrderStage = "PAYMENT" | "RECEIVED" | "PREPARING" | "READY" | "PICKED_UP" | "DELIVERED";
export const CUSTOMER_ORDER_STAGES: { key: CustomerOrderStage; label: string }[] = [
  { key: "PAYMENT", label: "Payment" },
  { key: "RECEIVED", label: "Kitchen received" },
  { key: "PREPARING", label: "Being prepared" },
  { key: "READY", label: "Ready for pickup" },
  { key: "PICKED_UP", label: "Picked up" },
  { key: "DELIVERED", label: "Delivered" },
];
export function customerOrderStage(status: string, ticket: {
  pickupStatus: string;
  stationStates: { status: string }[];
} | null | undefined): CustomerOrderStage {
  if (status !== "PAID") return "PAYMENT";
  if (ticket?.pickupStatus === "DELIVERED") return "DELIVERED";
  if (ticket?.pickupStatus === "CLAIMED") return "PICKED_UP";
  if (ticket?.pickupStatus === "READY") return "READY";
  if (ticket?.stationStates.some(station => station.status !== "NEW")) return "PREPARING";
  return "RECEIVED";
}
