export function supplierOrderDateTimeFormatter(
  timeZone: string,
  dateStyle: "medium" | "full" = "medium",
) {
  return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle, timeStyle: "short" });
}
