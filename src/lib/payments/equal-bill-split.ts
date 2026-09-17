export const MAX_EQUAL_SPLIT_PEOPLE = 20;

export function splitBillEqually(amount: number, people: number): number[] {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("The bill amount must be greater than zero.");
  }
  if (
    !Number.isInteger(people) ||
    people < 2 ||
    people > MAX_EQUAL_SPLIT_PEOPLE
  ) {
    throw new Error(
      `Choose between 2 and ${MAX_EQUAL_SPLIT_PEOPLE} people.`,
    );
  }

  const totalCents = Math.round(amount * 100);
  if (people > totalCents) {
    throw new Error("Each person must owe at least $0.01.");
  }

  const baseCents = Math.floor(totalCents / people);
  const remainder = totalCents % people;

  return Array.from(
    { length: people },
    (_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100,
  );
}
