export const MAX_GUEST_COUNT = 100;

export function parseGuestCount(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const guestCount = Number(value);
  return Number.isInteger(guestCount) &&
    guestCount >= 1 &&
    guestCount <= MAX_GUEST_COUNT
    ? guestCount
    : null;
}
