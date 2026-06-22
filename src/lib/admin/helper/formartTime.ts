const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

export function formatTime(date: Date) {
  return timeFormatter.format(date);
}
